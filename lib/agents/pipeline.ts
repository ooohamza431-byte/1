import { runChain, type RunResult } from '@/lib/router/hedge';
import { pickTargetForAgent, type ChainTarget } from '@/lib/router/chain';
import type { Intent } from '@/lib/router/classify';
import type { ChatMessage, NormalizedUsage } from '@/lib/providers/types';
import type { ProjectFile } from '@/lib/db/schema';
import { AGENT_LABELS, PIPELINE_DEFAULTS, type AgentId } from '@/lib/constants';
import {
  AGENT_SYSTEM_PROMPTS,
  NO_FILES_CORRECTION,
  renderFileManifest,
  renderFilesForReview,
} from './prompts';
import {
  detectEntryFile,
  mergeFiles,
  parseDefects,
  parseFiles,
  parseReview,
  parseScore,
  looksLikeProseOnly,
  stripThinkingTags,
  type ReviewResult,
} from './parser';

/**
 * The build pipeline.
 *
 *   planner → coder → reviewer → fixer? → enhancer → judge? → hardener?
 *
 * Yields fine-grained events as they happen (so the UI can stream tokens,
 * thinking traces and pipeline state) and returns a `PipelineResult` once the
 * run finishes. Provider failover, hedging and key resolution all happen inside
 * `runChain`, so an agent call transparently survives a provider outage.
 */

export interface PipelineOptions {
  userId: string;
  prompt: string;
  history: ChatMessage[];
  intent: Intent;
  targets: ChainTarget[];
  thinking: boolean;
  webSearch: boolean;
  /** Admin-overridable knobs. */
  maxRounds?: number;
  targetScore?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export type PipelineEvent =
  | { type: 'agent_start'; agent: AgentId; label: string; provider?: string; model?: string }
  | { type: 'agent_done'; agent: AgentId; ok: boolean; chars: number; provider?: string; model?: string }
  | { type: 'delta'; agent: AgentId; text: string }
  | { type: 'thinking'; agent: AgentId; text: string }
  | { type: 'web'; agent: AgentId; results: Array<{ title: string; url?: string; content?: string }> }
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string }
  | {
      type: 'files';
      files: ProjectFile[];
      score: number | null;
      rounds: number;
      entryFile: string;
      partial: boolean;
    }
  | { type: 'usage'; usage: NormalizedUsage }
  | { type: 'error'; message: string; fatal: boolean };

export interface PipelineResult {
  ok: boolean;
  /** The natural-language answer (chat mode, or a build's closing summary). */
  text: string;
  thinking: string;
  files: ProjectFile[];
  score: number | null;
  rounds: number;
  entryFile: string;
  plan: string;
  review: ReviewResult | null;
  usage: NormalizedUsage;
  providers: string[];
  /** Provider/model that served the final turn, for message attribution. */
  provider: string | null;
  model: string | null;
  /** Wall-clock duration of the whole pipeline. */
  latencyMs: number;
  error?: string;
}

const emptyUsage = (): NormalizedUsage => ({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });

function addUsage(target: NormalizedUsage, addition: NormalizedUsage): NormalizedUsage {
  return {
    promptTokens: target.promptTokens + addition.promptTokens,
    completionTokens: target.completionTokens + addition.completionTokens,
    totalTokens: target.totalTokens + addition.totalTokens,
    costUsd: (target.costUsd ?? 0) + (addition.costUsd ?? 0),
  };
}

interface AgentCall {
  agent: AgentId;
  system: string;
  messages: ChatMessage[];
  thinking?: boolean;
  webSearch?: boolean;
  temperature?: number;
  maxTokens?: number;
  /** Which chain position to prefer for this role. */
  prefer?: 'first' | 'second' | 'fast';
  label?: string;
}

export interface AgentContext {
  userId: string;
  targets: ChainTarget[];
  signal?: AbortSignal;
}

interface AgentOutcome {
  result: RunResult;
  text: string;
  thinking: string;
}

/**
 * Runs one agent turn through the router, forwarding stream events and
 * returning the completed result.
 */
async function* callAgent(
  ctx: AgentContext,
  opts: AgentCall,
): AsyncGenerator<PipelineEvent, AgentOutcome, void> {
  const targets =
    opts.prefer === 'fast'
      ? reorderFor(ctx.targets, 'fast')
      : opts.prefer === 'second'
        ? reorderFor(ctx.targets, 'second')
        : ctx.targets;

  yield {
    type: 'agent_start',
    agent: opts.agent,
    label: opts.label ?? AGENT_LABELS[opts.agent],
  };

  const iterator = runChain({
    userId: ctx.userId,
    targets,
    messages: opts.messages,
    system: opts.system,
    agent: opts.agent,
    thinking: opts.thinking ?? false,
    webSearch: opts.webSearch ?? false,
    temperature: opts.temperature,
    maxTokens: opts.maxTokens ?? PIPELINE_DEFAULTS.maxOutputTokens,
    signal: ctx.signal,
  });

  const buffer: string[] = [];
  let thinkingText = '';
  let step = await iterator.next();
  let currentProvider: string | undefined;
  let currentModel: string | undefined;

  while (!step.done) {
    const event = step.value;
    switch (event.type) {
      case 'attempt':
        currentProvider = event.provider;
        currentModel = event.model;
        yield { type: 'log', level: 'info', message: `${opts.agent} → ${event.provider} · ${event.model}` };
        break;
      case 'delta':
        buffer.push(event.text);
        currentProvider = event.provider;
        currentModel = event.model;
        yield { type: 'delta', agent: opts.agent, text: event.text };
        break;
      case 'thinking':
        thinkingText += event.text;
        yield { type: 'thinking', agent: opts.agent, text: event.text };
        break;
      case 'web':
        yield { type: 'web', agent: opts.agent, results: event.results };
        break;
      case 'usage':
        yield { type: 'usage', usage: event.usage };
        break;
      case 'failover':
        yield {
          type: 'log',
          level: 'warn',
          message: `${event.from} failed (${event.kind}) — failing over to ${event.to}`,
        };
        break;
      case 'error':
        yield { type: 'error', message: event.message, fatal: false };
        break;
      default:
        break;
    }
    step = await iterator.next();
  }

  const result = step.value;
  const text = stripThinkingTags(buffer.join(''));

  yield {
    type: 'agent_done',
    agent: opts.agent,
    ok: result.ok,
    chars: text.length,
    provider: currentProvider,
    model: currentModel,
  };

  return { result, text, thinking: thinkingText };
}

/** Put a fast/lower-latency target first for latency-sensitive roles. */
function reorderFor(targets: ChainTarget[], preference: 'fast' | 'second'): ChainTarget[] {
  if (targets.length <= 1) return targets;
  if (preference === 'second') {
    return [...targets.slice(1), targets[0]];
  }
  const fast = targets.find((t) => (t.provider.defaultModels.fast ?? []).some((m) => m === t.model));
  if (!fast) return targets;
  return [fast, ...targets.filter((t) => t !== fast)];
}

export async function* runPipeline(
  opts: PipelineOptions,
): AsyncGenerator<PipelineEvent, PipelineResult, void> {
  const started = Date.now();
  let usage = emptyUsage();
  const providers = new Set<string>();
  const maxRounds = opts.maxRounds ?? PIPELINE_DEFAULTS.maxRounds;
  const targetScore = opts.targetScore ?? PIPELINE_DEFAULTS.targetScore;

  let files: ProjectFile[] = [];
  let plan = '';
  let review: ReviewResult | null = null;
  let score: number | null = null;
  let rounds = 0;
  let final = '';
  let thinkingAll = '';
  let failure: string | undefined;

  const baseMessages: ChatMessage[] = [...opts.history];
  const agentCtx: AgentContext = {
    userId: opts.userId,
    targets: opts.targets,
    signal: opts.signal,
  };

  let last: { provider: string | null; model: string | null; latencyMs: number } = {
    provider: null,
    model: null,
    latencyMs: 0,
  };

  const track = (result: RunResult) => {
    usage = addUsage(usage, result.usage);
    if (result.provider) providers.add(result.provider);
    last = { provider: result.provider, model: result.model, latencyMs: result.latencyMs };
  };

  /* ------------------------------------------------------------------ */
  /*  CHAT MODE — one agent call, no pipeline                            */
  /* ------------------------------------------------------------------ */
  if (opts.intent.mode === 'chat') {
    const { result, text, thinking } = yield* callAgent(agentCtx, {
      agent: 'chat',
      system: AGENT_SYSTEM_PROMPTS.chat,
      messages: [...baseMessages, { role: 'user', content: opts.prompt }],
      thinking: opts.thinking,
      webSearch: opts.webSearch && !opts.intent.needsVision,
      temperature: 0.7,
    });
    track(result);
    thinkingAll += thinking;

    if (!result.ok) {
      return {
        ok: false,
        text: '',
        thinking: thinkingAll,
        files: [],
        score: null,
        rounds: 0,
        entryFile: '',
        plan: '',
        review: null,
        usage,
        providers: Array.from(providers),
        provider: last.provider,
        model: last.model,
        latencyMs: Date.now() - started,
        error: result.error ?? 'All providers failed.',
      };
    }

    // A model that answered with files anyway still produces a project card.
    const accidental = parseFiles(text);
    if (accidental.length > 0) {
      files = accidental;
      yield {
        type: 'files',
        files,
        score: null,
        rounds: 0,
        entryFile: detectEntryFile(files),
        partial: true,
      };
    }

    return {
      ok: true,
      text,
      thinking: thinkingAll,
      files,
      score: null,
      rounds: 0,
      entryFile: files.length > 0 ? detectEntryFile(files) : '',
      plan: '',
      review: null,
      usage,
      providers: Array.from(providers),
      provider: last.provider,
      model: last.model,
      latencyMs: Date.now() - started,
    };
  }

  /* ------------------------------------------------------------------ */
  /*  BUILD MODE                                                         */
  /* ------------------------------------------------------------------ */

  /* 1 — PLANNER */
  yield { type: 'log', level: 'info', message: `Pipeline: ${opts.intent.agents.join(' → ')}` };
  const plannerTurn = yield* callAgent(agentCtx, {
    agent: 'planner',
    system: AGENT_SYSTEM_PROMPTS.planner,
    messages: [
      ...baseMessages,
      { role: 'user', content: opts.prompt },
      {
        role: 'user',
        content: `Plan the build. Extra constraints from the router: language hint = ${
          opts.intent.language ?? 'none'
        }, scope = ${opts.intent.scope}, complexity = ${opts.intent.complexity}.`,
      },
    ],
    thinking: false,
    maxTokens: 6_000,
    temperature: 0.4,
    prefer: 'first',
  });
  track(plannerTurn.result);
  plan = plannerTurn.text;
  thinkingAll += `\n[Planner]\n${plannerTurn.text}\n`;

  if (!plannerTurn.result.ok && plan.length === 0) {
    failure = plannerTurn.result.error ?? 'The planner could not produce a plan.';
    yield { type: 'error', message: failure, fatal: true };
    return {
      ok: false,
      text: '',
      thinking: thinkingAll,
      files: [],
      score: null,
      rounds: 0,
      entryFile: '',
      plan: '',
      review: null,
      usage,
      providers: Array.from(providers),
      provider: last.provider,
      model: last.model,
      latencyMs: Date.now() - started,
      error: failure,
    };
  }

  /* 2 — CODER (with one corrective retry) */
  const coderMessages: ChatMessage[] = [
    ...baseMessages,
    { role: 'user', content: opts.prompt },
    { role: 'assistant', content: plan },
    { role: 'user', content: 'Implement this specification completely. Output the files now.' },
  ];

  let coderTurn = yield* callAgent(agentCtx, {
    agent: 'coder',
    system: AGENT_SYSTEM_PROMPTS.coder,
    messages: coderMessages,
    thinking: false,
    temperature: 0.3,
    prefer: 'first',
    maxTokens: opts.intent.scope === 'multi-file' ? 32_000 : 20_000,
  });
  track(coderTurn.result);
  final = coderTurn.text;
  files = parseFiles(coderTurn.text);

  if (files.length === 0) {
    yield {
      type: 'log',
      level: 'warn',
      message: 'No parseable file blocks in the first coder pass — requesting a corrected full output.',
    };
    coderTurn = yield* callAgent(agentCtx, {
      agent: 'coder',
      system: AGENT_SYSTEM_PROMPTS.coder,
      messages: [
        ...coderMessages,
        { role: 'assistant', content: coderTurn.text.slice(0, 4_000) },
        { role: 'user', content: NO_FILES_CORRECTION },
      ],
      thinking: false,
      temperature: 0.2,
      prefer: 'first',
      maxTokens: opts.intent.scope === 'multi-file' ? 32_000 : 20_000,
    });
    track(coderTurn.result);
    files = parseFiles(coderTurn.text);
    if (files.length > 0) final = coderTurn.text;
  }

  if (files.length === 0) {
    // The model answered in prose. Deliver the prose rather than a broken build
    // card, and say plainly that nothing was generated.
    const message = looksLikeProseOnly(final)
      ? 'The model returned an explanation instead of files after two attempts. Sending the explanation back — try rephrasing with "build a working single-file app".'
      : 'No files were produced. Please retry.';
    yield { type: 'log', level: 'error', message };
    yield {
      type: 'files',
      files: [],
      score: null,
      rounds: 0,
      entryFile: '',
      partial: true,
    };
    return {
      ok: false,
      text: final,
      thinking: thinkingAll,
      files: [],
      score: null,
      rounds: 0,
      entryFile: '',
      plan,
      review: null,
      usage,
      providers: Array.from(providers),
      provider: last.provider,
      model: last.model,
      latencyMs: Date.now() - started,
      error: message,
    };
  }

  yield {
    type: 'files',
    files,
    score: null,
    rounds: 0,
    entryFile: detectEntryFile(files),
    partial: true,
  };
  yield { type: 'log', level: 'info', message: `${files.length} file(s) generated (${renderFileManifest(files).split('\n').length} entries).` };

  /* 3 — REVIEWER */
  if (opts.intent.complexity !== 'trivial' && opts.targets.length > 0) {
    const reviewTurn = yield* callAgent(agentCtx, {
      agent: 'reviewer',
      system: AGENT_SYSTEM_PROMPTS.reviewer,
      messages: [
        { role: 'user', content: `SPECIFICATION:\n${plan.slice(0, 12_000)}` },
        { role: 'user', content: `IMPLEMENTATION:\n${renderFilesForReview(files)}` },
        { role: 'user', content: 'Review the implementation now.' },
      ],
      thinking: false,
      temperature: 0.1,
      maxTokens: 4_000,
      prefer: 'second',
    });
    track(reviewTurn.result);
    review = parseReview(reviewTurn.text);
    thinkingAll += `\n[Reviewer]\n${reviewTurn.text}\n`;

    if (!review.approved && review.defects.length > 0) {
      yield {
        type: 'log',
        level: 'warn',
        message: `Reviewer found ${review.defects.length} defect(s) — running the fixer.`,
      };
      const fixerTurn = yield* callAgent(agentCtx, {
        agent: 'fixer',
        system: AGENT_SYSTEM_PROMPTS.fixer,
        messages: [
          { role: 'user', content: `DEFECTS TO FIX:\n${review.defects.map((d) => `- ${d}`).join('\n')}` },
          { role: 'user', content: `CURRENT FILES:\n${renderFilesForReview(files)}` },
          { role: 'user', content: 'Emit the corrected files now.' },
        ],
        thinking: false,
        temperature: 0.2,
        prefer: 'first',
      });
      track(fixerTurn.result);
      const fixed = parseFiles(fixerTurn.text);
      if (fixed.length > 0) {
        files = mergeFiles(files, fixed);
        final = fixerTurn.text;
        yield {
          type: 'files',
          files,
          score: null,
          rounds: 0,
          entryFile: detectEntryFile(files),
          partial: true,
        };
        yield { type: 'log', level: 'info', message: `Fixer rewrote ${fixed.length} file(s).` };
      } else {
        yield { type: 'log', level: 'warn', message: 'Fixer returned no parseable files; keeping the original build.' };
      }
    } else if (review.approved) {
      yield { type: 'log', level: 'info', message: 'Reviewer approved the build.' };
    }
  }

  /* 4 — ENHANCER */
  if (opts.intent.complexity !== 'trivial' && opts.targets.length > 0) {
    const enhancerTurn = yield* callAgent(agentCtx, {
      agent: 'enhancer',
      system: AGENT_SYSTEM_PROMPTS.enhancer,
      messages: [
        { role: 'user', content: `CURRENT FILES:\n${renderFilesForReview(files, 80_000)}` },
        { role: 'user', content: 'Polish these files. Re-emit only the files you improved.' },
      ],
      thinking: false,
      temperature: 0.3,
      prefer: 'fast',
    });
    track(enhancerTurn.result);
    const enhanced = parseFiles(enhancerTurn.text);
    if (enhanced.length > 0) {
      files = mergeFiles(files, enhanced);
      final = enhancerTurn.text;
      yield {
        type: 'files',
        files,
        score: null,
        rounds: 0,
        entryFile: detectEntryFile(files),
        partial: true,
      };
      yield { type: 'log', level: 'info', message: `Enhancer polished ${enhanced.length} file(s).` };
    }
  }

  /* 5 — JUDGE / HARDENER LOOP */
  if (opts.intent.harden && opts.targets.length > 0) {
    for (let round = 1; round <= maxRounds; round += 1) {
      rounds = round;
      const judgeTurn = yield* callAgent(agentCtx, {
        agent: 'judge',
        system: AGENT_SYSTEM_PROMPTS.judge,
        messages: [
          { role: 'user', content: `SPECIFICATION:\n${plan.slice(0, 10_000)}` },
          { role: 'user', content: `IMPLEMENTATION:\n${renderFilesForReview(files, 100_000)}` },
          { role: 'user', content: `Grade this build. Round ${round} of ${maxRounds}.` },
        ],
        thinking: false,
        temperature: 0.1,
        maxTokens: 2_500,
        prefer: 'first',
      });
      track(judgeTurn.result);
      const judged = parseScore(judgeTurn.text);
      const defects = parseDefects(judgeTurn.text);
      thinkingAll += `\n[Judge · round ${round}]\n${judgeTurn.text}\n`;
      if (judged !== null) score = judged;

      yield {
        type: 'log',
        level: 'info',
        message: `Judge round ${round}: score ${score ?? 'n/a'}/10, ${defects.length} defect(s).`,
      };

      if (score !== null && score >= targetScore) {
        yield { type: 'log', level: 'info', message: `Target score ${targetScore} reached — hardening complete.` };
        break;
      }
      if (defects.length === 0) {
        yield { type: 'log', level: 'info', message: 'No actionable defects reported — stopping the harden loop.' };
        break;
      }
      if (round === maxRounds) {
        yield { type: 'log', level: 'warn', message: `Reached the ${maxRounds}-round cap; keeping the best build.` };
        break;
      }

      const hardenerTurn = yield* callAgent(agentCtx, {
        agent: 'hardener',
        system: AGENT_SYSTEM_PROMPTS.hardener,
        messages: [
          { role: 'user', content: `SCORE: ${score ?? 'unknown'}/10` },
          { role: 'user', content: `DEFECTS:\n${defects.map((d) => `- ${d}`).join('\n')}` },
          { role: 'user', content: `CURRENT FILES:\n${renderFilesForReview(files, 90_000)}` },
          { role: 'user', content: 'Fix exactly these defects and re-emit the changed files.' },
        ],
        thinking: false,
        temperature: 0.2,
        prefer: 'first',
      });
      track(hardenerTurn.result);
      const hardened = parseFiles(hardenerTurn.text);
      if (hardened.length === 0) {
        yield { type: 'log', level: 'warn', message: 'Hardener returned no files — ending the loop.' };
        break;
      }
      files = mergeFiles(files, hardened);
      yield {
        type: 'files',
        files,
        score,
        rounds: round,
        entryFile: detectEntryFile(files),
        partial: true,
      };
      yield { type: 'log', level: 'info', message: `Hardener round ${round} rewrote ${hardened.length} file(s).` };
    }
  }

  const entryFile = detectEntryFile(files);
  const elapsed = Date.now() - started;
  yield {
    type: 'files',
    files,
    score,
    rounds,
    entryFile,
    partial: false,
  };
  yield {
    type: 'log',
    level: 'info',
    message: `Build complete in ${(elapsed / 1000).toFixed(1)}s across ${providers.size} provider(s).`,
  };

  // The chat bubble for a build is a short summary, not the raw file dumps.
  const summary =
    final && final.length > 0 && parseFiles(final).length === 0
      ? final
      : `Built **${files.length} file${files.length === 1 ? '' : 's'}**${
          score !== null ? ` · judge score **${score}/10**` : ''
        }.\n\n${files.map((f) => `- \`${f.path}\` (${f.bytes} bytes)`).join('\n')}\n\nUse the preview pane to run it, or export ZIP / PDF from the project card.`;

  return {
    ok: true,
    text: summary,
    thinking: thinkingAll,
    files,
    score,
    rounds,
    entryFile,
    plan,
    review,
    usage,
    providers: Array.from(providers),
    provider: last.provider,
    model: last.model,
    latencyMs: elapsed,
  };
}

/**
 * Exported for tests and the pipeline indicator.
 *
 * `classifyPrompt` has already folded the judge/hardener stages into
 * `intent.agents` (it only does so when `deepHarden` is set), so this is a
 * passthrough — kept as a single source of truth for "what will actually run".
 */
export function pipelineSequence(intent: Intent): AgentId[] {
  return intent.agents;
}

export { pickTargetForAgent };

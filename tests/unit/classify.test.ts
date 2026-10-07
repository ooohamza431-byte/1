import { describe, expect, it } from 'vitest';
import { classifyPrompt, shouldShortCircuit } from '@/lib/router/classify';
import { pipelineSequence } from '@/lib/agents/pipeline';
import { BUILD_AGENT_IDS } from '@/lib/constants';

/**
 * The classifier decides whether a prompt becomes a chat or a full multi-agent
 * build, and which agents run. It is heuristic by design — the tests pin the
 * behaviour that matters (a question is never a build, a build request always
 * produces a coder) rather than exact scores.
 */
describe('classifyPrompt', () => {
  it('treats a plain question as chat with no agents', () => {
    const intent = classifyPrompt({ text: 'What is the difference between a process and a thread?' });
    expect(intent.mode).toBe('chat');
    expect(intent.agents).toEqual([]);
    expect(shouldShortCircuit(intent)).toBe(false);
  });

  it('short-circuits a throwaway chat turn', () => {
    expect(shouldShortCircuit(classifyPrompt({ text: 'hi' }))).toBe(true);
  });

  it('treats an explicit build request as a build', () => {
    const intent = classifyPrompt({ text: 'Build a todo app with a dark mode toggle and localStorage.' });
    expect(intent.mode).toBe('build');
    expect(intent.agents).toContain('coder');
    expect(intent.agents).toContain('planner');
    expect(intent.agents[0]).toBe('planner');
    expect(intent.language).toBe('html');
  });

  it('honours a forced mode from the UI toggle', () => {
    expect(classifyPrompt({ text: 'hello there', forceMode: 'build' }).mode).toBe('build');
    expect(classifyPrompt({ text: 'Build me a whole SaaS dashboard', forceMode: 'chat' }).mode).toBe('chat');
    expect(classifyPrompt({ text: 'Build me a whole SaaS dashboard', forceMode: 'chat' }).agents).toEqual([]);
  });

  it('marks vision requirements when an image is attached', () => {
    const intent = classifyPrompt({ text: 'What is wrong with this design?', hasImages: true, visionAvailable: true });
    expect(intent.needsVision).toBe(true);
    expect(intent.mode).toBe('chat');
  });

  it('warns in the reasons list when a requested capability is unavailable', () => {
    const blind = classifyPrompt({ text: 'What is wrong with this screenshot?', hasImages: true });
    expect(blind.reasons.join(' ')).toMatch(/vision/i);

    const offline = classifyPrompt({ text: 'What is the latest Node.js release today?' });
    expect(offline.needsWeb).toBe(true);
    expect(offline.reasons.join(' ')).toMatch(/web/i);
  });

  it('escalates to a multi-file build when the prompt describes a real app', () => {
    const intent = classifyPrompt({
      text: 'Create a full-stack Next.js app with authentication, a database and REST API endpoints.',
    });
    expect(intent.mode).toBe('build');
    expect(intent.scope).toBe('multi-file');
    expect(intent.complexity).toBe('complex');
    expect(intent.agents).toContain('reviewer');
    expect(intent.agents).toContain('fixer');
    expect(intent.estimatedOutputTokens).toBeGreaterThanOrEqual(24_000);
  });

  it('always explains itself', () => {
    const intent = classifyPrompt({ text: 'Build a landing page with a hero and a pricing table.' });
    expect(intent.reasons.length).toBeGreaterThan(0);
    expect(intent.complexity).toMatch(/trivial|simple|moderate|complex|ambitious/);
    expect(intent.estimatedOutputTokens).toBeGreaterThan(0);
  });

  it('detects an obvious language hint', () => {
    const intent = classifyPrompt({ text: 'Write a Python script that renames files in a folder.' });
    expect(['python', 'py']).toContain(intent.language);
  });

  describe('the judge/hardener loop', () => {
    const buildPrompt =
      'Build a pomodoro timer with adjustable work and break intervals, a sound alert at the end of each phase, and a streak counter that survives a page reload.';

    it('is off unless the user asks for it', () => {
      const intent = classifyPrompt({ text: buildPrompt });
      expect(intent.harden).toBe(false);
      expect(intent.agents).not.toContain('judge');
      expect(intent.agents).not.toContain('hardener');
    });

    it('runs judge then hardener last when Deep Harden is on', () => {
      const intent = classifyPrompt({ text: buildPrompt, deepHarden: true });
      expect(intent.harden).toBe(true);
      expect(intent.agents).toContain('judge');
      expect(intent.agents).toContain('hardener');
      expect(intent.agents[intent.agents.length - 1]).toBe('hardener');
      expect(intent.agents.indexOf('judge')).toBeLessThan(intent.agents.indexOf('hardener'));
    });

    it('skips the loop for a throwaway one-liner even when Deep Harden is on', () => {
      // A scoring round on "Build a calculator app." is pure latency.
      const intent = classifyPrompt({ text: 'Build a calculator app.', deepHarden: true });
      expect(intent.harden).toBe(false);
    });

    it('never hardens a chat turn', () => {
      const intent = classifyPrompt({ text: 'Explain closures in JavaScript.', forceMode: 'chat', deepHarden: true });
      expect(intent.harden).toBe(false);
      expect(intent.agents).toEqual([]);
    });
  });

  it('ends a build with the enhancer, and never emits an unknown agent', () => {
    const intent = classifyPrompt({ text: 'Build a markdown note-taking app with folders and search.' });
    expect(intent.agents[intent.agents.length - 1]).toBe('enhancer');
    for (const agent of intent.agents) {
      expect(BUILD_AGENT_IDS).toContain(agent);
    }
  });

  it('reports the sequence the runtime will actually execute', () => {
    const intent = classifyPrompt({
      text: 'Create a full-stack Next.js app with authentication, a database and REST API endpoints.',
      deepHarden: true,
    });
    expect(pipelineSequence(intent)).toEqual(intent.agents);
    expect(pipelineSequence(intent)).toEqual(['planner', 'coder', 'reviewer', 'fixer', 'enhancer', 'judge', 'hardener']);
  });

  it('is deterministic for the same input', () => {
    const first = classifyPrompt({ text: 'Build a weather dashboard with a 5-day forecast.' });
    const second = classifyPrompt({ text: 'Build a weather dashboard with a 5-day forecast.' });
    expect(second).toEqual(first);
  });
});

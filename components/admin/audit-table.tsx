'use client';

import * as React from 'react';
import { Activity, Filter, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAdminAudit } from '@/hooks/use-admin';
import { formatDateTime, timeAgo } from '@/lib/utils/format';

/**
 * Audit log.
 *
 * Every mutating admin action lands here with the actor, the target, the
 * concrete change and the request metadata. It is the reason the admin panel can
 * be handed to more than one person: failures and mistakes are attributable.
 */
export function AuditTable() {
  const [action, setAction] = React.useState('all');
  const [limit, setLimit] = React.useState(200);
  const [filter, setFilter] = React.useState('');

  const { data, isLoading, isFetching, refetch } = useAdminAudit({
    action: action === 'all' ? undefined : action,
    limit,
  });

  const entries = React.useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const rows = data?.entries ?? [];
    if (!needle) return rows;
    return rows.filter((entry) =>
      `${entry.action} ${entry.adminEmail ?? ''} ${entry.targetType ?? ''} ${entry.targetId ?? ''} ${JSON.stringify(
        entry.details ?? {},
      )}`
        .toLowerCase()
        .includes(needle),
    );
  }, [data, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {(data?.actions ?? []).map((item) => (
              <SelectItem key={item.action} value={item.action}>
                {item.action} ({item.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter by admin, target or detail…"
          className="max-w-72"
        />

        <Select value={String(limit)} onValueChange={(value) => setLimit(Number(value))}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[100, 200, 500, 1000].map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} rows
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button size="sm" variant="outline" className="ml-auto" onClick={() => void refetch()} loading={isFetching}>
          <RefreshCw /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-11 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<Activity />}
          title="No audit entries match"
          description="Admin actions appear here the moment they happen — keys added, users banned, features toggled, database exported."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Origin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-[11px] text-muted-foreground">
                    <span className="block">{timeAgo(entry.createdAt)}</span>
                    <span className="block text-[10px]">{formatDateTime(entry.createdAt)}</span>
                  </TableCell>

                  <TableCell>
                    <Badge variant="admin">{entry.action}</Badge>
                  </TableCell>

                  <TableCell className="text-[11px]">{entry.adminEmail ?? entry.adminId.slice(0, 8)}</TableCell>

                  <TableCell className="text-[11px] text-muted-foreground">
                    {entry.targetType ?? '—'}
                    {entry.targetId ? (
                      <span className="block max-w-40 truncate font-mono text-[10px]">{entry.targetId}</span>
                    ) : null}
                  </TableCell>

                  <TableCell className="max-w-md">
                    <code className="block max-h-16 overflow-y-auto scrollbar-thin whitespace-pre-wrap break-all font-mono text-[10px] text-muted-foreground">
                      {entry.details ? JSON.stringify(entry.details, null, 1).slice(0, 600) : '—'}
                    </code>
                  </TableCell>

                  <TableCell className="text-[10px] text-muted-foreground">
                    <span className="block font-mono">{entry.ipAddress ?? '—'}</span>
                    <span className="block max-w-40 truncate">{entry.userAgent ?? ''}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Filter className="size-3" />
        {entries.length} entr{entries.length === 1 ? 'y' : 'ies'} shown
        {data && data.count !== entries.length ? ` (filtered from ${data.count})` : ''}
      </p>
    </div>
  );
}

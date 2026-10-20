import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Header, Screen } from '@/components/layout';
import { Button, Loader, Text } from '@/components/ui';
import { myReports, reportNotices } from './reports';
export function MyReportsScreen() {
  const reports = useInfiniteQuery({ queryKey: ['my-reports'], initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => myReports(pageParam), getNextPageParam: page => page.nextCursor || undefined });
  const notices = useQuery({ queryKey: ['report-notices'], queryFn: reportNotices });
  return <Screen scroll><Header title="My reports" back />
    {reports.isPending ? <Loader /> : reports.isError ? <Button label="Retry reports" onPress={() => void reports.refetch()} /> : <>
      {!reports.data.pages.some(page => page.reports.length) ? <Text>No reports yet.</Text> : null}
      {reports.data.pages.flatMap(page => page.reports).map(report => <Text key={report.reportId}>Case {report.reportId.slice(0, 8)} · {report.status.replace(/_/g, ' ')}</Text>)}
      {reports.hasNextPage ? <Button label="Load more" loading={reports.isFetchingNextPage} onPress={() => void reports.fetchNextPage()} /> : null}
      <Button label="Refresh status" onPress={() => { void reports.refetch(); void notices.refetch(); }} variant="secondary" />
    </>}
    {notices.data?.map((notice, index) => <Text key={`${notice.metadata?.reportId || notice.createdAt}:${index}`}>{notice.message}</Text>)}
  </Screen>;
}

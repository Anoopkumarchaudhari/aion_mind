import { NotebookDetailContent } from "@/components/NotebookDetailContent";

type NotebookPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function NotebookPage({ params }: NotebookPageProps) {
  const { id } = await params;

  return <NotebookDetailContent notebookId={id} />;
}

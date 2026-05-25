import { ChatDashboard } from "@/components/ChatDashboard";

type ChatPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ChatPage({ params }: ChatPageProps) {
  const { id } = await params;

  return <ChatDashboard initialThreadId={id} />;
}

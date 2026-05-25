import { VideoSessionContent } from "@/components/VideoSessionContent";

type VideoSessionPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function VideoSessionPage({ params }: VideoSessionPageProps) {
  const { id } = await params;

  return <VideoSessionContent videoId={id} />;
}

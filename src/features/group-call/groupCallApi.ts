import apiClient from "../../lib/axios";

interface ActiveGroupCallSession {
  id: string;
  callType: string;
  conversationId: string;
  channelName: string;
  hostUserId: string;
  status: string;
  participants: Array<{ userId: string; role: string; status: string }>;
  startedAt: string;
  isParticipant: boolean;
}

export async function getActiveGroupCallForConversation(
  conversationId: string,
): Promise<{ callId: string; channelName: string } | null> {
  try {
    const { data } = await apiClient.get<{ session: ActiveGroupCallSession | null }>(
      "/api/calls/group/active",
      { params: { conversationId } },
    );
    const session = data.session;
    if (session && session.status === "ACTIVE") {
      return { callId: session.id, channelName: session.channelName };
    }
    return null;
  } catch {
    return null;
  }
}

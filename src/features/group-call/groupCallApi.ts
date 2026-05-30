import { getActiveCall } from "../call/callApi";

export async function getActiveGroupCallForConversation(
  conversationId: string,
): Promise<{ callId: string; channelName: string } | null> {
  try {
    const res = await getActiveCall();
    const call = res.call;
    if (call && call.callMode === "group" && call.conversationId === conversationId) {
      return { callId: call.callId, channelName: call.channelName };
    }
    return null;
  } catch {
    return null;
  }
}

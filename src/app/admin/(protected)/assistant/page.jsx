import ChatAssistant from "@/components/ChatAssistant";

export const metadata = { title: "AI Assistant" };

export default function AdminAssistantPage() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-display text-ink">AI Assistant</h1>
        <p className="text-sm text-muted mt-1">
          Ask about sales, profit, stock, orders and expenses. Read-only.
        </p>
      </div>
      <ChatAssistant mode="admin" variant="page" />
    </div>
  );
}

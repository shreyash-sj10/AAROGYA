import { useEffect, useMemo, useRef, useState } from "react";
import { askPlanAssistant, askPlanExplanation, type PlanChatMealContext } from "@/services/api/assistant.api";
import type { DecisionResponseV1 } from "@/contracts/DecisionResponseV1";
import type { DailyResponseV1 } from "@/contracts/DailyResponseV1";
import type { UserContext } from "@/store/userContext.store";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type PlanChatProps = {
  plan: DecisionResponseV1 | DailyResponseV1;
  userContext: UserContext;
  constraints: {
    max_calories: number;
    diet_type: string;
  };
  plannerContext: {
    meals: PlanChatMealContext[];
    diet_type: string;
    preferences: string[];
    exclusions: string[];
  };
  latestError: string | null;
  disabled: boolean;
  onReplaceFood: (mealId: string, foodId: string, mealType: "breakfast" | "lunch" | "dinner") => Promise<boolean>;
  onRegenerateMeal: (mealId: string, mealType: "breakfast" | "lunch" | "dinner") => Promise<boolean>;
};

const MISSING_INPUT_MESSAGE = "Please complete required fields.";
const NO_CANDIDATES_MESSAGE = "No valid plan found under constraints.";
const INVALID_ACTION_MESSAGE = "I couldn't understand that request.";

function newMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: `${role}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
  };
}

function mapChatErrorMessage(message: string | null | undefined): string {
  const normalized = String(message || "").toLowerCase();

  if (
    normalized.includes("missing")
    || normalized.includes("required")
    || normalized.includes("diet type")
    || normalized.includes("diet_type")
    || normalized.includes("meal type")
    || normalized.includes("meal_type")
    || normalized.includes("calorie")
    || normalized.includes("planner inputs")
  ) {
    return MISSING_INPUT_MESSAGE;
  }

  if (
    normalized.includes("no valid")
    || normalized.includes("no candidates")
    || normalized.includes("constraints")
    || normalized.includes("no_valid_plan")
  ) {
    return NO_CANDIDATES_MESSAGE;
  }

  return INVALID_ACTION_MESSAGE;
}

export function PlanChat(props: PlanChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    newMessage("assistant", "This is Planner Chat, not a general chatbot. Ask meal-plan actions like replace lunch dal or regenerate dinner."),
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages, thinking]);

  const canSend = useMemo(() => {
    return !thinking && !props.disabled && input.trim().length > 0;
  }, [thinking, props.disabled, input]);

  const executeAction = async (result: Awaited<ReturnType<typeof askPlanAssistant>>): Promise<boolean> => {
    if (result.type !== "action" || !result.action) {
      return false;
    }

    if (result.action.type === "replace_food") {
      return props.onReplaceFood(
        result.action.payload.meal_id,
        result.action.payload.food_id,
        result.action.payload.meal_type,
      );
    }

    return props.onRegenerateMeal(
      result.action.payload.meal_id,
      result.action.payload.meal_type,
    );
  };

  const askExplanation = async () => {
    if (thinking || props.disabled) {
      return;
    }

    setThinking(true);
    try {
      setMessages((curr) => [...curr, newMessage("user", "Explain")]);
      const explanation = await askPlanExplanation({
        plan: props.plan,
        userContext: props.userContext,
        constraints: props.constraints,
        plannerContext: props.plannerContext,
      });
      setMessages((curr) => [...curr, newMessage("assistant", explanation)]);
    } catch {
      setMessages((curr) => [...curr, newMessage("assistant", "Explanation not available")]);
    } finally {
      setThinking(false);
    }
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || !canSend) {
      return;
    }

    setInput("");
    setMessages((curr) => [...curr, newMessage("user", trimmed)]);
    setThinking(true);

    try {
      const res = await askPlanAssistant({
        message: trimmed,
        plan: props.plan,
        userContext: props.userContext,
        constraints: props.constraints,
        plannerContext: props.plannerContext,
      });

      setMessages((curr) => [...curr, newMessage("assistant", res.message)]);

      if (res.type === "clarify" || res.type === "explanation" || res.type === "error") {
        return;
      }

      if (res.type === "action") {
        const ok = await executeAction(res);
        if (ok) {
          setMessages((curr) => [...curr, newMessage("assistant", "Updated your plan.")]);
        } else {
          setMessages((curr) => [
            ...curr,
            newMessage("assistant", mapChatErrorMessage(props.latestError)),
          ]);
        }
      }
    } catch {
      setMessages((curr) => [
        ...curr,
        newMessage("assistant", INVALID_ACTION_MESSAGE),
      ]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <section className="rounded-2xl border border-[#E6E1D8] bg-white p-5 shadow-sm h-full ui-elevate">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Planner Chat Control</p>
          <p className="mt-1 text-xs text-stone-600">Action scope: replace/regenerate meals only.</p>
        </div>
        <button
          type="button"
          onClick={() => { void askExplanation(); }}
          disabled={thinking || props.disabled}
          className="rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-[#2F2F2F] transition-all duration-200 hover:border-[#7A6F4B] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Explain
        </button>
      </div>

      <div ref={scrollerRef} className="ui-chat-scroll mt-3 max-h-[58vh] min-h-[360px] space-y-2 overflow-y-auto rounded-xl border border-[#E6E1D8] bg-[#F5F1E8] p-3">
        {messages.map((msg, index) => (
          <div
            key={msg.id}
            style={{ animationDelay: `${Math.min(index * 40, 220)}ms` }}
            className={`ui-fade-in rounded-xl px-3 py-2 text-sm ${msg.role === "user"
              ? "ml-auto max-w-[85%] bg-[#7A6F4B] text-white"
              : "max-w-[85%] bg-white text-[#2F2F2F]"
            }`}
          >
            {msg.content}
          </div>
        ))}
        {thinking ? <p className="text-xs text-gray-500 ui-fade-in">Thinking...</p> : null}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void sendMessage();
            }
          }}
          placeholder="Planner action, e.g. replace lunch dal"
          disabled={thinking || props.disabled}
          className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-[#2F2F2F] transition-all duration-200 focus:border-[#7A6F4B] focus:outline-none focus:ring-2 focus:ring-[#d9ccb4] disabled:cursor-not-allowed disabled:opacity-70"
        />
        <button
          type="button"
          onClick={() => { void sendMessage(); }}
          disabled={!canSend}
          className="rounded-xl bg-[#7A6F4B] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:translate-y-[-1px] hover:bg-[#6b6146] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Send
        </button>
      </div>
    </section>
  );
}

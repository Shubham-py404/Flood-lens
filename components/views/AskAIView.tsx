'use client';

import React, { useState } from 'react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  Loader2, 
  ShieldCheck 
} from 'lucide-react';
import { AssistantQueryResponse } from '@/types/api';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  citations?: AssistantQueryResponse['citations'];
  uncertainty?: string;
}

interface AskAIViewProps {
  userCoords: { lat: number; lng: number } | null;
}

let globalMessageSeq = 0;

export default function AskAIView({ userCoords }: AskAIViewProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hello! I am your TerraPulse Environmental Assistant. Ask me anything about current air quality, local flood hazards, or commute safety recommendations around your area.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const samplePrompts = [
    'How bad is the air quality right now?',
    'Are there any reported flooded roads nearby?',
    'Is it safe for outdoor cycling or jogging today?',
  ];

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || isLoading) return;

    globalMessageSeq += 1;
    const userMsgId = `usr-${globalMessageSeq}`;
    const userMsg: Message = {
      id: userMsgId,
      sender: 'user',
      text: textToSend,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/assistant/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          lat: userCoords?.lat || 28.6315,
          lng: userCoords?.lng || 77.2167,
        }),
      });

      if (!res.ok) throw new Error('Query failed');
      const data: AssistantQueryResponse = await res.json();

      globalMessageSeq += 1;
      const assistantMsgId = `ast-${globalMessageSeq}`;
      const assistantMsg: Message = {
        id: assistantMsgId,
        sender: 'assistant',
        text: data.answer,
        citations: data.citations,
        uncertainty: data.uncertainty_note,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('AI Assistant Query Error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `ast-err-${Date.now()}`,
          sender: 'assistant',
          text: 'I could not retrieve live telemetry right now. Please inspect the interactive map directly for live reports.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col max-w-3xl mx-auto px-4 py-6 md:px-8 pb-28 md:pb-8">
      {/* Header */}
      <div className="border-b border-[#e2e0d8] pb-4 mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[#1c2621] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#244837]" />
            Environmental Intelligence Advisor
          </h1>
          <p className="text-xs text-[#617469] mt-1 font-medium">
            Field synthesis cross-referencing live Open-Meteo telemetry with citizen observations
          </p>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-none">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.sender === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-[#f0f4f1] text-[#244837] flex items-center justify-center shrink-0 mt-0.5 border border-[#d6e0d9]">
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}

            <div
              className={`max-w-[85%] md:max-w-[78%] rounded-2xl p-4 text-xs md:text-sm leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-[#244837] text-white rounded-br-xs shadow-xs'
                  : 'bg-white text-[#1c2621] border border-[#e2e0d8] rounded-bl-xs shadow-xs'
              }`}
            >
              <div className="whitespace-pre-wrap">{m.text}</div>

              {/* Citations block */}
              {m.citations && m.citations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[#eceae1] space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#3a7d5c] block font-mono">
                    Grounded Telemetry Sources
                  </span>
                  {m.citations.map((c, i) => (
                    <div key={i} className="text-[11px] bg-[#f8f7f4] p-2 rounded-lg border border-[#eceae1] text-[#405247]">
                      <strong className="text-[#1c2621]">{c.title}:</strong> {c.value}
                    </div>
                  ))}
                </div>
              )}

              {/* Uncertainty disclaimer */}
              {m.uncertainty && (
                <div className="mt-2 text-[10px] text-[#77887e] flex items-center gap-1 font-mono">
                  <ShieldCheck className="w-3 h-3 text-[#77887e] shrink-0" />
                  <span>{m.uncertainty}</span>
                </div>
              )}
            </div>

            {m.sender === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-[#f6f0eb] text-[#8a7258] flex items-center justify-center shrink-0 mt-0.5 border border-[#e4d6c7]">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-7 h-7 rounded-lg bg-[#f0f4f1] text-[#244837] flex items-center justify-center shrink-0 border border-[#d6e0d9]">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-white rounded-2xl p-3 border border-[#e2e0d8] text-xs text-[#617469] flex items-center gap-2 shadow-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3a7d5c]" />
              <span>Synthesizing field conditions and telemetry arrays...</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Prompts */}
      <div className="mt-4 pt-2">
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {samplePrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(p)}
              disabled={isLoading}
              className="text-[11px] font-medium bg-white/80 backdrop-blur-md hover:bg-white text-[#405247] px-3 py-1.5 rounded-lg border border-[#e2e0d8] hover:border-[#b4cabe] transition-all cursor-pointer shadow-xs disabled:opacity-50 text-left"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Input box */}
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-xl border border-[#d6d3c7] rounded-xl p-1.5 shadow-sm focus-within:border-[#244837] focus-within:ring-2 focus-within:ring-[#244837]/15 transition-all">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about atmospheric readings, flooded streets, or commute safety..."
            className="flex-1 bg-transparent border-none text-xs text-[#1c2621] px-3 py-2 outline-none placeholder:text-[#87968e]"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="p-2 bg-[#244837] hover:bg-[#1b382b] text-white rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-xs"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

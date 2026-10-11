'use client';

import React, { useState } from 'react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  Loader2, 
  ShieldCheck, 
  HelpCircle,
  ExternalLink
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

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
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

      const assistantMsg: Message = {
        id: `ast-${Date.now()}`,
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
      <div className="border-b border-slate-200/80 pb-4 mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-teal-600" />
            AI Environmental Assistant
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Grounded intelligence powered by AWS Bedrock & real telemetry
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
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 text-xs md:text-sm leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-gradient-to-r from-teal-600 to-blue-600 text-white rounded-br-none shadow-sm'
                  : 'bg-white/90 text-slate-800 border border-slate-200/80 rounded-bl-none shadow-sm'
              }`}
            >
              <div className="whitespace-pre-wrap">{m.text}</div>

              {/* Citations block */}
              {m.citations && m.citations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 block">
                    Grounded Telemetry Sources
                  </span>
                  {m.citations.map((c, i) => (
                    <div key={i} className="text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-200/60 text-slate-700">
                      <strong>{c.title}:</strong> {c.value}
                    </div>
                  ))}
                </div>
              )}

              {/* Uncertainty disclaimer */}
              {m.uncertainty && (
                <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{m.uncertainty}</span>
                </div>
              )}
            </div>

            {m.sender === 'user' && (
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white/90 rounded-2xl p-3.5 border border-slate-200/80 text-xs text-slate-500 flex items-center gap-2 shadow-xs">
              <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
              <span>Analyzing live telemetry & cross-referencing hazards...</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Prompts */}
      <div className="mt-4 pt-2">
        <div className="flex flex-wrap gap-2 mb-3">
          {samplePrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(p)}
              disabled={isLoading}
              className="text-[11px] bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 px-3 py-1.5 rounded-full transition-all cursor-pointer text-left shadow-2xs hover:shadow-xs"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Input box */}
        <div className="flex items-center gap-2 bg-white/90 border border-slate-200/80 rounded-2xl p-1.5 shadow-md backdrop-blur-md">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about air quality or waterlogging in your sector..."
            className="flex-1 bg-transparent border-none text-xs md:text-sm text-slate-800 px-3 py-2 outline-none placeholder:text-slate-400"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="p-2.5 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 disabled:opacity-40 text-white rounded-xl shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

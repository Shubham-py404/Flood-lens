'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, AlertCircle } from 'lucide-react';

interface VoiceReporterProps {
  onTranscriptChange: (transcript: string) => void;
  onDepthExtracted?: (depth: string) => void;
  disabled?: boolean;
}

function extractDepthFromText(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes('ankle') || lower.includes('feet') || lower.includes('foot') || lower.includes('shallow')) {
    return 'Ankle-deep (<15cm)';
  }
  if (lower.includes('knee') || lower.includes('half meter') || lower.includes('shin')) {
    return 'Knee-deep (15-50cm)';
  }
  if (lower.includes('waist') || lower.includes('hip') || lower.includes('stuck') || lower.includes('submerged')) {
    return 'Waist-deep (50-100cm)';
  }
  if (lower.includes('chest') || lower.includes('neck') || lower.includes('severe') || lower.includes('stranded')) {
    return 'Severe (>100cm)';
  }
  return null;
}

export default function VoiceReporter({
  onTranscriptChange,
  onDepthExtracted,
  disabled = false,
}: VoiceReporterProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let currentTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript + ' ';
      }
      const clean = currentTranscript.trim();
      setTranscript(clean);
      onTranscriptChange(clean);

      const detectedDepth = extractDepthFromText(clean);
      if (detectedDepth && onDepthExtracted) {
        onDepthExtracted(detectedDepth);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch (_) {}
    };
  }, [onTranscriptChange, onDepthExtracted]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      onTranscriptChange('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }
    }
  };

  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 text-xs">
        <AlertCircle className="w-4 h-4 text-gray-400 shrink-0" />
        <span>Voice dispatch is not supported in this browser.</span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleListening}
          disabled={disabled}
          className={`flex-1 flex items-center justify-center gap-2.5 py-2 px-3.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
            isListening
              ? 'bg-red-50 border-red-300 text-red-700 shadow-xs'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-xs'
          }`}
        >
          {isListening ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
              </span>
              <MicOff className="w-3.5 h-3.5 text-red-600" />
              <span>Listening... Tap to finish</span>
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5 text-gray-500" />
              <span>Voice Dictation</span>
            </>
          )}
        </button>
      </div>

      {transcript && (
        <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-700">
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-1">
            Transcribed Audio
          </span>
          <p className="leading-relaxed text-gray-800 italic">“{transcript}”</p>
        </div>
      )}
    </div>
  );
}

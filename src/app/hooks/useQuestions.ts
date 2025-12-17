import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWebSocket } from './useWebSocket';

interface Question {
  question_id: number;
  user_id: number | null;
  message: string;
  status: 'Pending' | 'Escalated' | 'Answered';
  timestamp: string;
  answers: Answer[];
}

interface Answer {
  answer_id: number;
  user_id: number | null;
  message: string;
  timestamp: string;
}

interface WebSocketMessage {
  type: string;
  data: any;
}

export function useQuestions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get token from sessionStorage (only on client side)
  const token = useMemo(
    () => (typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null),
    []
  );

  // Memoize WebSocket URL
  const wsUrl = useMemo(
    () => process.env.NEXT_PUBLIC_WS_URL || 'wss://hemut-backend-xs3c.onrender.com/ws',
    []
  );

  // Memoize WebSocket callbacks to prevent reconnections
  const handleOpen = useCallback(() => {
    console.log('✅ Connected to questions WebSocket');
    setError(null);
  }, []);

  const handleError = useCallback(() => {
    setError('WebSocket connection failed');
  }, []);

  const { isConnected, lastMessage, sendMessage } = useWebSocket({
    url: wsUrl,
    token,
    onOpen: handleOpen,
    onError: handleError,
  });

  // Request initial data when connected and set timeout for loading state
  useEffect(() => {
    if (isConnected) {
      console.log('🔄 WebSocket connected, requesting initial data...');
      // Request initial data from server
      sendMessage({ type: 'get_questions' });
      
      // Fallback: Stop loading after 5 seconds even if no data received
      const loadingTimeout = setTimeout(() => {
        console.warn('⚠️ No initial data received after 5s, stopping loader');
        setLoading(false);
      }, 5000);

      return () => clearTimeout(loadingTimeout);
    }
  }, [isConnected, sendMessage]);

  // Handle incoming WebSocket messages with optimized updates
  useEffect(() => {
    if (!lastMessage) return;

    const { type, data } = lastMessage as WebSocketMessage;
    console.log('📨 Received WebSocket message - Type:', type, '| Data:', data);

    switch (type) {
      case 'initial_data':
      case 'questions_list':
      case 'questions': // Another common variant
        console.log(`📥 Received ${data?.length || 0} questions`);
        setQuestions(data || []);
        setLoading(false);
        break;

      case 'new_question':
        console.log('🆕 New question received:', data.question_id);
        setQuestions((prev) => {
          // Prevent duplicates
          if (prev.some((q) => q.question_id === data.question_id)) {
            return prev;
          }
          return [data, ...prev];
        });
        setLoading(false); // Ensure loading is stopped
        break;

      case 'answer_added':
        console.log('💬 Answer added to question:', data.question_id);
        setQuestions((prev) =>
          prev.map((q) => (q.question_id === data.question_id ? data : q))
        );
        break;

      case 'question_status_changed':
        console.log(
          '🔄 Question status changed:',
          data.question_id,
          '->',
          data.status
        );
        setQuestions((prev) =>
          prev.map((q) => (q.question_id === data.question_id ? data : q))
        );
        break;

      case 'refresh_data':
        console.log('🔄 Refreshed questions data');
        setQuestions(data || []);
        setLoading(false);
        break;

      case 'pong':
        // Keepalive response - no action needed
        break;

      default:
        console.log('❓ Unknown message type:', type);
        // Fallback: If data is an array, treat it as questions list
        if (Array.isArray(data)) {
          console.log('📥 Treating unknown message as questions list');
          setQuestions(data);
          setLoading(false);
        }
    }
  }, [lastMessage]);

  // Memoize refresh function
  const refreshQuestions = useCallback(() => {
    sendMessage({ type: 'refresh' });
  }, [sendMessage]);

  // Return memoized object to prevent unnecessary re-renders in consuming components
  return useMemo(
    () => ({
      questions,
      loading,
      error,
      isConnected,
      refreshQuestions,
    }),
    [questions, loading, error, isConnected, refreshQuestions]
  );
}

import { useEffect, useState } from "react";
import { Question, backend } from "../utils/backend";
import { AlertCircle, ArrowUp, CheckCircle, Clock, LogOut, MessageSquare, Send } from "lucide-react";
import { User } from "../utils/backend";

export const ForumPage = ({ user, onLogout }: { user: User | null; onLogout: () => void }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');  
  const [answerInputs, setAnswerInputs] = useState<Record<number, string>>({});
  const [aiSuggestions, setAiSuggestions] = useState<Record<number, string>>({});
  const [loadingAI, setLoadingAI] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setQuestions(backend.getQuestions());

    const unsubscribe = backend.addWebSocketListener((message) => {
      if (message.type === 'new_question') {
        setQuestions(backend.getQuestions());
        if (user?.is_admin) {
          showNotification('New question received!');
        }
      } else if (message.type === 'question_updated') {
        setQuestions(backend.getQuestions());
      }
    });

    return unsubscribe;
  }, [user]);

  const showNotification = (message :string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Q&A Dashboard', { body: message });
    }
  };

  useEffect(() => {
    if (user?.is_admin && 'Notification' in window) {
      Notification.requestPermission();
    }
  }, [user]);

  const validateQuestion = (text :string) => {
    return text.trim().length > 0;
  };

  const handleSubmitQuestion = () => {
    setError('');
    setSuccess('');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/validate-question', true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onload = () => {
      if (validateQuestion(newQuestion)) {
        try {
          backend.submitQuestion(newQuestion, user?.user_id);
          setNewQuestion('');
          setSuccess('Question submitted successfully!');
          setTimeout(() => setSuccess(''), 3000);
        } catch (err:any) {
          setError(err.message);
        }
      } else {
        setError('Question cannot be blank');
      }
    };

    xhr.send(JSON.stringify({ question: newQuestion }));
  };

  const handleMarkAnswered = (questionId: number) => {
    try {
      backend.markAnswered(questionId);
      setSuccess('Question marked as answered!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err:any) {
      setError(err.message);
    }
  };

  const handleEscalate = (questionId: number) => {
    try {
      backend.escalateQuestion(questionId);
      setSuccess('Question escalated!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err:any) {
      setError(err.message);
    }
  };

  const handleAddAnswer = (questionId: number) => {
    const answer = answerInputs[questionId];
    if (!answer?.trim()) {
      setError('Answer cannot be blank');
      return;
    }

    try {
      backend.addAnswer(questionId, answer, user?.user_id);
      setAnswerInputs({ ...answerInputs, [questionId]: '' });
      setSuccess('Answer added!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err:any) {
      setError(err.message);
    }
  };

  const handleGetAISuggestion = async (questionId: number, message: string) => {
    setLoadingAI({ ...loadingAI, [questionId]: true });
    try {
      const suggestion = await backend.generateAISuggestion(message);
      setAiSuggestions({ ...aiSuggestions, [questionId]: suggestion });
    } catch (err) {
      setError('Failed to get AI suggestion');
    } finally {
      setLoadingAI({ ...loadingAI, [questionId]: false });
    }
  };

  const formatTimestamp = (timestamp   :string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getStatusColor = (status :string) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Escalated': return 'bg-red-100 text-red-800 border-red-300';
      case 'Answered': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-8 h-8 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-800">Q&A Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-sm text-gray-600">
                  {user.username} {user.is_admin && <span className="text-indigo-600 font-semibold">(Admin)</span>}
                </span>
                <button
                  onClick={onLogout}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </>
            ) : (
              <span className="text-sm text-gray-600">Guest User</span>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {success}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Submit a Question</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSubmitQuestion()}
              placeholder="Type your question here..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button
              onClick={handleSubmitQuestion}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Send className="w-4 h-4" />
              Submit
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Questions ({questions.length})</h2>
          {questions.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
              No questions yet. Be the first to ask!
            </div>
          ) : (
            questions.map((q) => (
              <div key={q.question_id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <p className="text-lg text-gray-800 mb-2">{q.message}</p>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatTimestamp(q.timestamp)}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(q.status)}`}>
                        {q.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {user?.is_admin && q.status !== 'Answered' && (
                      <>
                        <button
                          onClick={() => handleMarkAnswered(q.question_id)}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                        >
                          Mark Answered
                        </button>
                        {q.status !== 'Escalated' && (
                          <button
                            onClick={() => handleEscalate(q.question_id)}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm flex items-center gap-1"
                          >
                            <ArrowUp className="w-3 h-3" />
                            Escalate
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {q.answers.length > 0 && (
                  <div className="mt-4 space-y-2 border-t pt-3">
                    <h4 className="text-sm font-semibold text-gray-700">Answers:</h4>
                    {q.answers.map((ans) => (
                      <div key={ans.answer_id} className="bg-gray-50 p-3 rounded">
                        <p className="text-gray-800">{ans.message}</p>
                        <span className="text-xs text-gray-500 mt-1 block">
                          {formatTimestamp(ans.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {aiSuggestions[q.question_id] && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-sm font-semibold text-blue-800 mb-1">AI Suggestion:</p>
                    <p className="text-sm text-blue-700">{aiSuggestions[q.question_id]}</p>
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <input
                    type="text"
                    value={answerInputs[q.question_id] || ''}
                    onChange={(e) => setAnswerInputs({ ...answerInputs, [q.question_id]: e.target.value })}
                    placeholder="Type your answer..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => handleAddAnswer(q.question_id)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors text-sm"
                  >
                    Answer
                  </button>
                  <button
                    onClick={() => handleGetAISuggestion(q.question_id, q.message)}
                    disabled={loadingAI[q.question_id]}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-sm disabled:opacity-50"
                  >
                    {loadingAI[q.question_id] ? 'Loading...' : 'AI Suggest'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ForumPage;
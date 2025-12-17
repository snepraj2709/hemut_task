
export interface User {
  user_id: number;
  username: string;
  email?: string;
  is_admin: boolean;
}

export interface Question {
  question_id: number;
  user_id: number | null;
  message: string;
  status: 'Pending' | 'Escalated' | 'Answered';
  timestamp: string;
  answers: Answer[];
}

export interface Answer {
  answer_id: number;
  user_id: number | null;
  message: string;
  timestamp: string;
}

class Backend {
  baseUrl: string;
  private token: string | null = null;
  private wsListeners: ((message: any) => void)[] = [];
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor() {
    // For static export (output: "export"), we need NEXT_PUBLIC_ prefix
    // This gets embedded at build time
    let url = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || 'http://13.203.220.208:8000';
    // Sanitize URL: remove trailing slash if present
    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }
    this.baseUrl = url;

    // Load token from storage if available
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('access_token');
    }
  }

  // --- Auth Helpers ---
  private getHeaders() {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async fetchAPI(endpoint: string, options: RequestInit = {}) {
    // endpoint should start with /
    const url = `${this.baseUrl}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      mode: 'cors', // Explicit CORS mode for cross-origin requests
      credentials: 'include', // Include credentials (cookies, auth headers)
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.detail?.msg || data.detail || 'API Error');
    }
    return data;
  }

  // --- User Management ---
  
  async register(username: string, email: string, password: string) {
    // /api/auth/register
    const data = await this.fetchAPI('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
    // Expected response might be { access_token: ..., user: ... } or similar.
    // Based on docs: TokenResponse -> access_token, token_type, user
    if (data.access_token) {
      this.setToken(data.access_token);
    }
    return data.user;
  }

  async login(username: string, password: string) {
    // /api/auth/login
    const data = await this.fetchAPI('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (data.access_token) {
      this.setToken(data.access_token);
    }
    return data.user;
  }

  logout() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
    }
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', token);
    }
  }

  getUser() {
    // Decode token or fetch /api/auth/me? For now, we rely on the object returned during login/register
    // But if page reloads, we might want to fetch me.
    // Implementing a quick me check:
    return this.fetchAPI('/api/auth/me').catch(() => null);
  }

  // --- Question Management ---

  async getQuestions(): Promise<Question[]> {
    return this.fetchAPI('/api/questions');
  }

  async submitQuestion(message: string, userId: number | null = null) {
    // POST /api/questions
    // Request body: QuestionSubmit { message: string }
    // Note: userId is inferred from token if logged in. If guest, API handles it? 
    // Docs say "Submit a new question (guests allowed - user is Optional)" 
    // We send message. The backend likely infers user from token.
    return this.fetchAPI('/api/questions', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async addAnswer(questionId: number, answer: string, userId: number | null = null) {
    // POST /api/questions/{question_id}/answers
    // Body: AnswerSubmit { message: string }
    return this.fetchAPI(`/api/questions/${questionId}/answers`, {
      method: 'POST',
      body: JSON.stringify({ message: answer }),
    });
  }

  async markAnswered(questionId: number) {
    // PUT /api/questions/{question_id}/mark-answered
    return this.fetchAPI(`/api/questions/${questionId}/mark-answered`, {
      method: 'PUT',
    });
  }

  async escalateQuestion(questionId: number) {
    // PUT /api/questions/{question_id}/escalate
    return this.fetchAPI(`/api/questions/${questionId}/escalate`, {
      method: 'PUT',
    });
  }

  async generateAISuggestion(questionId: number) {
     // original prototype was generateAISuggestion(message) but real API is by ID
     // POST /api/questions/{question_id}/ai-suggest
     // The response structure isn't fully detailed in plan but we'll assume it returns the suggestion or void?
     // Docs say "Get Ai Suggestion ... responses 200 {}".
     // If it returns void, maybe it updates the question or returns the answer text?
     // I'll assume it might return result. If not, I'll log it.
     // Let's assume the API returns the suggestion string or object.
     return this.fetchAPI(`/api/questions/${questionId}/ai-suggest`, {
       method: 'POST'
     });
  }

  // --- WebSocket / Real-time Simulation ---

  addWebSocketListener(callback: (message: any) => void) {
    this.wsListeners.push(callback);
    
    // Start polling if not already started
    if (!this.pollingInterval) {
      this.pollingInterval = setInterval(async () => {
        try {
          // In a real WS, we get delta updates. Here we might just signal "refresh needed"
          // Or we fetch questions and compare?
          // Simplest for now: Just signal 'new_question' or 'update' generically to force re-fetch
          // But that causes infinite re-renders if not careful. 
          // Better approach: The component calls getQuestions(), we just want to tell it "hey, update available".
          // Let's indiscriminately notify every 10s?
          // Or just poll silently?
          // Actually, the component calls addWebSocketListener and then expects messages like { type: 'new_question' }.
          // Let's simulate a heartbeat that says "check_updates".
          // The current component logic:
          // if (message.type === 'new_question') setQuestions(...)
          // if (message.type === 'question_updated') setQuestions(...)
          
          // So we can simply trigger these events every few seconds to force a refresh.
          this.broadcastToWebSocket({ type: 'question_updated' }); 
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 5000); // 5 seconds poll
    }

    return () => {
      this.wsListeners = this.wsListeners.filter(cb => cb !== callback);
      if (this.wsListeners.length === 0 && this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
      }
    };
  }

  private broadcastToWebSocket(message: any) {
    this.wsListeners.forEach(listener => listener(message));
  }
}

export const backend = new Backend();

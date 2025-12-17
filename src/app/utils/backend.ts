
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

// Mock Backend API (simulating FastAPI + WebSocket + Database)
export class MockBackend {
  questions: Question[];
  users: any[]; // Keeping generic for now to match looseness of original, or better strictness
  nextQuestionId: number;
  nextUserId: number;
  wsListeners: ((message: any) => void)[];
  webhookUrl: string;

  constructor() {
    this.questions = [];
    this.users = [
      { user_id: 1, username: 'admin', email: 'admin@example.com', password: 'admin123', is_admin: true }
    ];
    this.nextQuestionId = 1;
    this.nextUserId = 2;
    this.wsListeners = [];
    this.webhookUrl = 'https://webhook.site/mock-endpoint';
  }

  // User Management
  register(username: string, email: string, password: string) {
    if (this.users.find(u => u.username === username || u.email === email)) {
      throw new Error('User already exists');
    }
    const user = {
      user_id: this.nextUserId++,
      username,
      email,
      password,
      is_admin: false
    };
    this.users.push(user);
    return { user_id: user.user_id, username: user.username, is_admin: user.is_admin };
  }

  login(username: string, password: string) {
    const user = this.users.find(u => u.username === username && u.password === password);
    if (!user) {
      throw new Error('Invalid credentials');
    }
    return { user_id: user.user_id, username: user.username, is_admin: user.is_admin };
  }

  // Questions Management
  submitQuestion(message: string, userId: number | null = null) {
    const question: Question = {
      question_id: this.nextQuestionId++,
      user_id: userId,
      message,
      status: 'Pending',
      timestamp: new Date().toISOString(),
      answers: []
    };
    this.questions.push(question);
    this.broadcastToWebSocket({ type: 'new_question', data: question });
    return question;
  }

  getQuestions() {
    return [...this.questions].sort((a, b) => {
      // Sort priority: Escalated > Pending > Answered, then by time
      const score = (status:string) => {
        if (status === 'Escalated') return 3;
        if (status === 'Pending') return 2;
        return 1;
      };
      
      const scoreA = score(a.status);
      const scoreB = score(b.status);
      
      if (scoreA !== scoreB) return scoreB - scoreA;
      
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }

  markAnswered(questionId: number) {
    const question = this.questions.find(q => q.question_id === questionId);
    if (question) {
      question.status = 'Answered';
      this.broadcastToWebSocket({ type: 'question_updated', data: question });
      this.triggerWebhook(question);
      return question;
    }
    throw new Error('Question not found');
  }

  escalateQuestion(questionId: number) {
    const question = this.questions.find(q => q.question_id === questionId);
    if (question) {
      question.status = 'Escalated';
      this.broadcastToWebSocket({ type: 'question_updated', data: question });
      return question;
    }
    throw new Error('Question not found');
  }

  addAnswer(questionId: number, answer: string, userId: number | null = null) {
    const question = this.questions.find(q => q.question_id === questionId);
    if (question) {
      question.answers.push({
        answer_id: Date.now(),
        user_id: userId,
        message: answer,
        timestamp: new Date().toISOString()
      });
      this.broadcastToWebSocket({ type: 'question_updated', data: question });
      return question;
    }
    throw new Error('Question not found');
  }

  // RAG/Langchain Mock Integration
  async generateAISuggestion(message: string) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const suggestions = [
      "Based on similar queries, you might want to check our documentation at docs.example.com",
      "This appears to be a technical issue. Have you tried restarting the service?",
      "For account-related questions, please verify your email is confirmed.",
      "This is a common question. The answer typically involves checking your settings first."
    ];
    return suggestions[Math.floor(Math.random() * suggestions.length)];
  }

  // WebSocket Simulation
  addWebSocketListener(callback: (message: any) => void) {
    this.wsListeners.push(callback);
    return () => {
      this.wsListeners = this.wsListeners.filter(cb => cb !== callback);
    };
  }

  broadcastToWebSocket(message: any) {
    this.wsListeners.forEach(listener => listener(message));
  }

  // Webhook Simulation
  async triggerWebhook(question: Question) {
    console.log(`[WEBHOOK] Sending to ${this.webhookUrl}:`, {
      event: 'question_answered',
      question_id: question.question_id,
      message: question.message,
      timestamp: new Date().toISOString()
    });
  }
}

export const backend = new MockBackend();

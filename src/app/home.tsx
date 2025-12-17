
"use client";
import { useState } from 'react';
import { User } from './utils/backend';
import RegisterPage from './components/register';
import LoginPage from './components/login';
import ForumPage from './components/forum';

export default function Home() {
  const [currentPage, setCurrentPage] = useState('login');
  const [user, setUser] = useState<User | null>(null);

  const handleLogin = (userData:User) => {
    setUser(userData);
    setCurrentPage('forum');
  };

  const handleRegister = (userData:User) => {
    setUser(userData);
    setCurrentPage('forum');
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentPage('login');
  };

  const handleGuestAccess = () => {
    setUser(null);
    setCurrentPage('forum');
  };

  if (currentPage === 'login') {
    return (
      <div>
        <LoginPage
          onLogin={handleLogin}
          onSwitchToRegister={() => setCurrentPage('register')}
        />
        <div className="fixed bottom-4 right-4">
          <button
            onClick={handleGuestAccess}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors shadow-lg"
          >
            Continue as Guest
          </button>
        </div>
      </div>
    );
  }

  if (currentPage === 'register') {
    return (
      <RegisterPage
        onRegister={handleRegister}
        onSwitchToLogin={() => setCurrentPage('login')}
      />
    );
  }

  return <ForumPage user={user} onLogout={handleLogout} />;
}
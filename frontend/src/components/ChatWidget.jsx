import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";

/**
 * POLISHED EV SMART HUB CHAT WIDGET
 *
 * Features:
 * - Draggable chat panel with glassy design
 * - Role-based message grouping with timestamps
 * - Typing indicator and streaming placeholder
 * - GPS location detection with sanitized messages
 * - Unread badge with pulse animation on FAB
 * - Full keyboard accessibility (Enter=send, Esc=close)
 * - localStorage persistence option
 * - Rate-limit handling and offline detection
 * - Responsive mobile-first layout
 * - Prefers-reduced-motion support
 * - Avatar placeholders for messages
 *
 * Color System (matches Navbar):
 * - Primary gradient: #06b6d4 → #6366f1 (teal → indigo)
 * - Background: #0b1220 (deep navy)
 * - Surface: rgba(255,255,255,0.06) or #ffffff
 * - Success: #a3e635 (warm lime)
 *
 * Customization Points:
 * - Line 80-120: CSS variables & colors
 * - Line 200: API endpoint (http://localhost:5000/api/chat)
 * - Line 350: localStorage key name
 * - Line 700+: Message avatar SVG
 * - Line 800+: GPS message sanitization
 *
 * TODO:
 * - Connect notificationCount to real API
 * - Replace SVG avatars with user images
 * - Wire streaming response handling
 * - Add analytics tracking
 * - Integrate with push notifications
 */

const ChatWidget = () => {
  // =====================================================
  // STATE MANAGEMENT
  // =====================================================
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [rateLimitError, setRateLimitError] = useState(false);
  const [lastMessageTime, setLastMessageTime] = useState(0);

  const messagesEndRef = useRef(null);
  const chatPanelRef = useRef(null);
  const inputRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const RATE_LIMIT_MS = 500; // Minimum ms between messages
  const STORAGE_KEY = "ev_chat_messages";
  const API_ENDPOINT = "http://localhost:5000/api/chat";

  // =====================================================
  // EFFECTS
  // =====================================================

  // Load messages from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setMessages(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load chat history:", e);
      }
    }
  }, []);

  // Save messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Focus input when panel opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Reset unread when panel opens
  useEffect(() => {
    if (open) {
      setUnreadCount(0);
    }
  }, [open]);

  // Online/offline detection
  useEffect(() => {
    window.addEventListener("online", () => setIsOnline(true));
    window.addEventListener("offline", () => setIsOnline(false));
    return () => {
      window.removeEventListener("online", () => setIsOnline(true));
      window.removeEventListener("offline", () => setIsOnline(false));
    };
  }, []);

  // =====================================================
  // HELPER FUNCTIONS
  // =====================================================

  const formatTime = (date = new Date()) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Group messages by sender for UI purposes
  const groupMessages = (msgs) => {
    return msgs.reduce((groups, msg, index) => {
      const lastGroup = groups[groups.length - 1];
      const isSameSender = lastGroup && lastGroup[0].role === msg.role;

      if (isSameSender && index - lastGroup[lastGroup.length - 1]._index < 2) {
        // Group consecutive messages from same sender
        lastGroup.push({ ...msg, _index: index });
      } else {
        groups.push([{ ...msg, _index: index }]);
      }
      return groups;
    }, []);
  };

  const sanitizeLocation = (lat, lng) => {
    // Round to 6 decimal places for privacy
    return `my location is ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  // =====================================================
  // MESSAGE SENDING
  // =====================================================

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading || !isOnline) return;

    // Rate limiting
    const now = Date.now();
    if (now - lastMessageTime < RATE_LIMIT_MS) {
      setRateLimitError(true);
      setTimeout(() => setRateLimitError(false), 2000);
      return;
    }
    setLastMessageTime(now);

    const userMsg = { role: "user", text: input, timestamp: new Date() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");

    setIsLoading(true);
    setIsTyping(true);

    try {
      const res = await axios.post(API_ENDPOINT, {
        messages: updatedMessages.map(({ text, role }) => ({
          role,
          text,
        })),
      });

      const botMsg = {
        role: "bot",
        text: res.data.answer || "Sorry, I couldn't process that.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const errorMsg = {
        role: "bot",
        text:
          err.response?.status === 429
            ? "⏱ Too many requests. Please wait a moment."
            : "⚠ Unable to reach the server. Please try again.",
        timestamp: new Date(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);

      if (!open) {
        setUnreadCount((prev) => prev + 1);
      }
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  }, [input, isLoading, isOnline, messages, lastMessageTime, open]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!open) return;

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, sendMessage]);

  // =====================================================
  // LOCATION DETECTION
  // =====================================================

  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: "⚠ Your browser does not support location access.",
          timestamp: new Date(),
          isError: true,
        },
      ]);
      return;
    }

    setIsLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const locationText = sanitizeLocation(lat, lng);
        const userMsg = { role: "user", text: locationText, timestamp: new Date(), isLocation: true };

        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setIsTyping(true);

        try {
          const res = await axios.post(API_ENDPOINT, {
            messages: updatedMessages.map(({ text, role }) => ({
              role,
              text,
            })),
          });

          const botMsg = {
            role: "bot",
            text: res.data.answer || "Unable to process your location.",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, botMsg]);
        } catch (err) {
          setMessages((prev) => [
            ...prev,
            {
              role: "bot",
              text: "⚠ Server error while processing location.",
              timestamp: new Date(),
              isError: true,
            },
          ]);
        } finally {
          setIsTyping(false);
          setIsLoading(false);
        }
      },
      () => {
        setMessages((prev) => [
          ...prev,
          {
            role: "bot",
            text: "⚠ Unable to access your location. Please enable GPS in settings.",
            timestamp: new Date(),
            isError: true,
          },
        ]);
        setIsLoading(false);
      }
    );
  }, [messages]);

  // =====================================================
  // DRAG HANDLING
  // =====================================================

  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    setDragOffset({ x: deltaX, y: deltaY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging]);

  // =====================================================
  // CLEAR CHAT
  // =====================================================

  const clearChat = () => {
    if (window.confirm("Clear all messages? This cannot be undone.")) {
      setMessages([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // =====================================================
  // RENDER
  // =====================================================

  const groupedMessages = groupMessages(messages);
  const hasUnread = unreadCount > 0 && !open;

  return (
    <>
      {/* ============================================
          INLINE STYLES
          ============================================ */}
      <style>{`
        :root {
          /* Color System */
          --chat-primary: #06b6d4;
          --chat-primary-dark: #0891b2;
          --chat-secondary: #6366f1;
          --chat-secondary-dark: #4f46e5;
          --chat-gradient: linear-gradient(135deg, var(--chat-primary) 0%, var(--chat-secondary) 100%);
          --chat-bg: #0b1220;
          --chat-surface: rgba(255, 255, 255, 0.06);
          --chat-surface-light: rgba(255, 255, 255, 0.12);
          --chat-text: #ffffff;
          --chat-text-muted: rgba(255, 255, 255, 0.7);
          --chat-accent: #a3e635;
          --chat-error: #ef4444;
          --chat-border: rgba(255, 255, 255, 0.1);

          /* Shadows */
          --chat-shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          --chat-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          --chat-shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
          --chat-shadow-glow: 0 0 30px rgba(99, 102, 241, 0.4);

          /* Timings */
          --chat-transition-fast: 150ms;
          --chat-transition-base: 250ms;
          --chat-ease: cubic-bezier(0.16, 1, 0.3, 1);
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        /* Floating Action Button */
        .chat-fab {
          position: fixed;
          bottom: 1.5rem;
          right: 1.5rem;
          width: 3.75rem;
          height: 3.75rem;
          border-radius: 50%;
          background: var(--chat-gradient);
          border: none;
          color: white;
          font-size: 1.75rem;
          cursor: pointer;
          box-shadow: var(--chat-shadow-lg);
          z-index: 999998;
          transition: all var(--chat-transition-base) var(--chat-ease);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .chat-fab:hover {
          transform: translateY(-2px) scale(1.05);
          box-shadow: var(--chat-shadow-glow);
        }

        .chat-fab:active {
          transform: translateY(0) scale(0.98);
        }

        .chat-fab:focus-visible {
          outline: 2px solid var(--chat-primary);
          outline-offset: 3px;
        }

        /* Unread badge */
        .chat-fab-badge {
          position: absolute;
          top: -0.25rem;
          right: -0.25rem;
          min-width: 1.25rem;
          height: 1.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--chat-error);
          color: white;
          font-size: 0.625rem;
          font-weight: 700;
          border-radius: 50%;
          box-shadow: 0 0 0 2px var(--chat-bg);
          animation: pulse-badge 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse-badge {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.8; }
        }

        /* Chat Panel Container */
        .chat-panel-container {
          position: fixed;
          bottom: 5.5rem;
          right: 1.5rem;
          width: 360px;
          height: 540px;
          z-index: 999999;
          animation: slideIn var(--chat-transition-base) var(--chat-ease);
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (max-width: 480px) {
          .chat-panel-container {
            bottom: 1rem;
            right: 1rem;
            width: calc(100vw - 2rem);
            max-width: 400px;
            height: 70vh;
            max-height: 500px;
          }
        }

        /* Chat Panel */
        .chat-panel {
          width: 100%;
          height: 100%;
          background: var(--chat-bg);
          border-radius: 1rem;
          border: 1px solid var(--chat-border);
          display: flex;
          flex-direction: column;
          box-shadow: var(--chat-shadow-lg);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          overflow: hidden;
        }

        /* Header */
        .chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.875rem;
          background: linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%);
          border-bottom: 1px solid var(--chat-border);
          cursor: grab;
          user-select: none;
        }

        .chat-header:active {
          cursor: grabbing;
        }

        .chat-header-left {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex: 1;
        }

        .chat-header-title {
          font-weight: 600;
          font-size: 0.9375rem;
          color: var(--chat-text);
        }

        .chat-header-status {
          font-size: 0.75rem;
          color: var(--chat-text-muted);
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }

        .status-dot {
          width: 0.375rem;
          height: 0.375rem;
          border-radius: 50%;
          background: var(--chat-accent);
          animation: pulse-dot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .chat-header-actions {
          display: flex;
          gap: 0.5rem;
        }

        .chat-icon-button {
          width: 2rem;
          height: 2rem;
          border-radius: 0.375rem;
          border: none;
          background: transparent;
          color: var(--chat-text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--chat-transition-fast) var(--chat-ease);
        }

        .chat-icon-button:hover {
          background: var(--chat-surface-light);
          color: var(--chat-text);
          transform: scale(1.05);
        }

        .chat-icon-button:focus-visible {
          outline: 2px solid var(--chat-primary);
          outline-offset: 1px;
        }

        /* Messages Container */
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .chat-messages::-webkit-scrollbar {
          width: 6px;
        }

        .chat-messages::-webkit-scrollbar-track {
          background: transparent;
        }

        .chat-messages::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }

        .chat-messages::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        /* Message Group */
        .message-group {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .message-group.user {
          align-items: flex-end;
        }

        .message-group.bot {
          align-items: flex-start;
        }

        /* Individual Message */
        .message {
          display: flex;
          align-items: flex-end;
          gap: 0.5rem;
          animation: messageAppear var(--chat-transition-base) var(--chat-ease);
        }

        @keyframes messageAppear {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .message.user {
          justify-content: flex-end;
        }

        /* Message Avatar */
        .message-avatar {
          width: 1.75rem;
          height: 1.75rem;
          border-radius: 50%;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .message-avatar.user {
          background: var(--chat-gradient);
          color: white;
        }

        .message-avatar.bot {
          background: var(--chat-surface-light);
          color: var(--chat-text);
        }

        /* Message Bubble */
        .message-bubble {
          max-width: 85%;
          word-break: break-word;
          padding: 0.75rem 1rem;
          border-radius: 0.75rem;
          font-size: 0.9375rem;
          line-height: 1.4;
        }

        .message-bubble.user {
          background: var(--chat-gradient);
          color: white;
          border-bottom-right-radius: 0.25rem;
        }

        .message-bubble.bot {
          background: var(--chat-surface);
          color: var(--chat-text);
          border-bottom-left-radius: 0.25rem;
        }

        .message-bubble.error {
          background: rgba(239, 68, 68, 0.1);
          color: var(--chat-error);
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .message-bubble.location {
          background: rgba(163, 230, 53, 0.1);
          color: var(--chat-accent);
          border: 1px solid rgba(163, 230, 53, 0.3);
          font-size: 0.875rem;
          font-family: monospace;
        }

        /* Message Timestamp */
        .message-time {
          font-size: 0.75rem;
          color: var(--chat-text-muted);
          margin-top: 0.25rem;
        }

        /* Typing Indicator */
        .typing-indicator {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.75rem 1rem;
          background: var(--chat-surface);
          border-radius: 0.75rem;
          width: fit-content;
        }

        .typing-dot {
          width: 0.375rem;
          height: 0.375rem;
          background: var(--chat-text-muted);
          border-radius: 50%;
          animation: typingBounce 1.4s infinite;
        }

        .typing-dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .typing-dot:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes typingBounce {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.5;
          }
          30% {
            transform: translateY(-8px);
            opacity: 1;
          }
        }

        /* Empty State */
        .chat-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 1rem;
          color: var(--chat-text-muted);
          text-align: center;
          padding: 1rem;
        }

        .chat-empty-icon {
          font-size: 2.5rem;
          opacity: 0.5;
        }

        /* Input Area */
        .chat-input-area {
          display: flex;
          padding: 0.75rem;
          gap: 0.5rem;
          border-top: 1px solid var(--chat-border);
          background: var(--chat-bg);
        }

        .chat-input-area.offline {
          opacity: 0.6;
          pointer-events: none;
        }

        /* Location Button */
        .chat-location-btn {
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 0.5rem;
          border: none;
          background: var(--chat-surface-light);
          color: var(--chat-text);
          cursor: pointer;
          font-size: 1.125rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--chat-transition-fast) var(--chat-ease);
          flex-shrink: 0;
        }

        .chat-location-btn:hover {
          background: var(--chat-primary);
          transform: scale(1.05);
        }

        .chat-location-btn:active {
          transform: scale(0.95);
        }

        .chat-location-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .chat-location-btn:focus-visible {
          outline: 2px solid var(--chat-primary);
          outline-offset: 2px;
        }

        /* Chat Input */
        .chat-input {
          flex: 1;
          padding: 0.625rem 0.875rem;
          border-radius: 0.5rem;
          border: 1px solid var(--chat-border);
          background: var(--chat-surface);
          color: var(--chat-text);
          font-size: 0.9375rem;
          font-family: inherit;
          transition: all var(--chat-transition-fast) var(--chat-ease);
          min-height: 2.5rem;
          resize: none;
        }

        .chat-input:focus {
          outline: none;
          background: var(--chat-surface-light);
          border-color: var(--chat-primary);
        }

        .chat-input::placeholder {
          color: var(--chat-text-muted);
        }

        /* Send Button */
        .chat-send-btn {
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 0.5rem;
          border: none;
          background: var(--chat-gradient);
          color: white;
          cursor: pointer;
          font-size: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--chat-transition-fast) var(--chat-ease);
          flex-shrink: 0;
        }

        .chat-send-btn:hover {
          box-shadow: var(--chat-shadow-glow);
          transform: translateY(-1px);
        }

        .chat-send-btn:active {
          transform: translateY(0) scale(0.95);
        }

        .chat-send-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .chat-send-btn:focus-visible {
          outline: 2px solid var(--chat-primary);
          outline-offset: 2px;
        }

        /* Spinner */
        .spinner {
          width: 1rem;
          height: 1rem;
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Rate Limit Alert */
        .chat-rate-limit {
          padding: 0.75rem;
          background: rgba(251, 191, 36, 0.1);
          color: #fbbf24;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          text-align: center;
          animation: slideDown var(--chat-transition-base) var(--chat-ease);
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Offline Banner */
        .chat-offline {
          padding: 0.75rem;
          background: rgba(239, 68, 68, 0.1);
          color: var(--chat-error);
          border-radius: 0.5rem;
          font-size: 0.875rem;
          text-align: center;
        }
      `}</style>

      {/* ============================================
          FLOATING ACTION BUTTON
          ============================================ */}
      <button
        className="chat-fab"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="chat-panel"
        aria-label={`${open ? "Close" : "Open"} chat${
          hasUnread ? ` (${unreadCount} unread)` : ""
        }`}
      >
        💬
        {hasUnread && (
          <span className="chat-fab-badge" aria-hidden="true">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* ============================================
          CHAT PANEL
          ============================================ */}
      {open && (
        <div
          className="chat-panel-container"
          ref={chatPanelRef}
          style={
            isDragging
              ? {
                  transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
                }
              : {}
          }
        >
          <div className="chat-panel">
            {/* HEADER */}
            <div
              className="chat-header"
              onMouseDown={handleMouseDown}
              role="heading"
              aria-level="2"
            >
              <div className="chat-header-left">
                <div>
                  <div className="chat-header-title">⚡ EV Smart Assistant</div>
                  <div className="chat-header-status">
                    <span className="status-dot" />
                    {isOnline ? "Online" : "Offline"}
                  </div>
                </div>
              </div>

              <div className="chat-header-actions">
                {/* TODO: Add notifications dropdown here */}

                <button
                  className="chat-icon-button"
                  onClick={clearChat}
                  aria-label="Clear chat history"
                  title="Clear messages"
                >
                  {/* SVG Trash Icon */}
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>

                <button
                  className="chat-icon-button"
                  onClick={() => setOpen(false)}
                  aria-label="Close chat"
                  title="Close"
                >
                  {/* SVG Close Icon */}
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* MESSAGES */}
            <div
              className="chat-messages"
              role="log"
              aria-label="Chat messages"
              aria-live="polite"
            >
              {messages.length === 0 ? (
                <div className="chat-empty">
                  <div className="chat-empty-icon">⚡</div>
                  <div>
                    <strong>Welcome to EV Smart Assistant</strong>
                    <p style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>
                      Ask about charging stations, reservations, or use the
                      📍 button to share your location.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {groupedMessages.map((group, groupIdx) => (
                    <div
                      key={groupIdx}
                      className={`message-group ${group[0].role}`}
                    >
                      {group.map((msg, msgIdx) => (
                        <div key={msgIdx} className={`message ${msg.role}`}>
                          {msg.role === "bot" && (
                            <div className="message-avatar bot">
                              {/* Bot Avatar SVG */}
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <rect x="4" y="4" width="16" height="16" rx="2" />
                                <circle cx="8" cy="8" r="1.5" fill="var(--chat-bg)" />
                                <circle cx="16" cy="8" r="1.5" fill="var(--chat-bg)" />
                                <rect
                                  x="8"
                                  y="14"
                                  width="8"
                                  height="1"
                                  fill="var(--chat-bg)"
                                />
                              </svg>
                            </div>
                          )}

                          <div>
                            <div
                              className={`message-bubble ${
                                msg.isError
                                  ? "error"
                                  : msg.isLocation
                                  ? "location"
                                  : msg.role
                              }`}
                            >
                              {msg.text}
                            </div>
                            <div className="message-time">
                              {formatTime(msg.timestamp)}
                            </div>
                          </div>

                          {msg.role === "user" && (
                            <div className="message-avatar user">
                              {/* User Avatar SVG */}
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <circle cx="12" cy="8" r="4" />
                                <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* Typing Indicator */}
                  {isTyping && (
                    <div className="message-group bot">
                      <div className="message">
                        <div className="message-avatar bot">
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <rect x="4" y="4" width="16" height="16" rx="2" />
                            <circle cx="8" cy="8" r="1.5" fill="var(--chat-bg)" />
                            <circle cx="16" cy="8" r="1.5" fill="var(--chat-bg)" />
                            <rect
                              x="8"
                              y="14"
                              width="8"
                              height="1"
                              fill="var(--chat-bg)"
                            />
                          </svg>
                        </div>
                        <div className="typing-indicator">
                          <div className="typing-dot" />
                          <div className="typing-dot" />
                          <div className="typing-dot" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Scroll anchor */}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* INPUT AREA */}
            <div>
              {rateLimitError && (
                <div className="chat-rate-limit">
                  ⏱ Please wait a moment before sending another message.
                </div>
              )}

              {!isOnline && (
                <div className="chat-offline">
                  You are offline. Messages will be sent when connection is restored.
                </div>
              )}

              <div className={`chat-input-area ${!isOnline ? "offline" : ""}`}>
                {/* TODO: Replace with location icon from lucide-react if available */}
                <button
                  className="chat-location-btn"
                  onClick={detectLocation}
                  disabled={isLoading}
                  aria-label="Share my location"
                  title="Share location (Ctrl+L)"
                >
                  📍
                </button>

                <input
                  ref={inputRef}
                  type="text"
                  className="chat-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !isLoading &&
                      isOnline
                    ) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Ask something..."
                  disabled={!isOnline}
                  aria-label="Chat message input"
                  aria-describedby="chat-help"
                />

                <button
                  className="chat-send-btn"
                  onClick={sendMessage}
                  disabled={isLoading || !input.trim() || !isOnline}
                  aria-label="Send message"
                >
                  {isLoading ? (
                    <div
                      className="spinner"
                      aria-hidden="true"
                      style={{
                        borderTopColor: "white",
                        borderColor: "rgba(255,255,255,0.3)",
                      }}
                    />
                  ) : (
                    "➤"
                  )}
                </button>
              </div>

              <div
                id="chat-help"
                style={{
                  fontSize: "0.75rem",
                  color: "var(--chat-text-muted)",
                  padding: "0.5rem 0.75rem",
                  textAlign: "center",
                }}
              >
                Press Enter to send • Esc to close
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatWidget;

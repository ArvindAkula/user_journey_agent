import React, { useState, useEffect, useRef } from 'react';
import { AnalyticsFilter } from '@aws-agent/shared';

interface AmazonQChatProps {
  filters: AnalyticsFilter;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const AmazonQChat: React.FC<AmazonQChatProps> = ({ filters, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQueries] = useState<string[]>([
    'What are the top struggle signals this week?',
    'Show me conversion rates by user segment',
    'Which videos have the highest completion rates?',
    'What are the main drop-off points in the user journey?'
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Add welcome message
    setMessages([{
      id: '1',
      type: 'assistant',
      content: 'Hello! I\'m Amazon Q, your AI analytics assistant. I can help you understand your user journey data, identify trends, and provide insights. What would you like to know?',
      timestamp: new Date()
    }]);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSendMessage = async (query?: string) => {
    const messageText = query || inputValue.trim();
    if (!messageText || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: messageText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Simulate AI response
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const response = generateMockResponse(messageText);
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again or rephrase your question.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockResponse = (query: string): string => {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('struggle') || lowerQuery.includes('signal')) {
      return `Based on your current data, I've identified 89 struggle signals this week. The top issues are:

1. **Calculator Timeout** (23 signals) - Users are experiencing timeouts during complex calculations
2. **Document Upload Failures** (18 signals) - File upload issues, particularly with larger documents  
3. **Login Difficulties** (15 signals) - Authentication problems on mobile devices

The struggle signals have decreased by 15% compared to last week, indicating improvements in user experience.`;
    }
    
    if (lowerQuery.includes('conversion') || lowerQuery.includes('rate')) {
      return `Current conversion rates by user segment:

📊 **Overall Conversion Rate: 68.5%** (+5.2% vs last period)

**By Segment:**
- New Users: 45.2% (+2.1%)
- Active Users: 72.8% (+3.4%) 
- Power Users: 89.1% (+1.2%)
- At Risk: 23.4% (-1.8%)

The Active Users segment shows the strongest improvement, likely due to recent UX enhancements in the calculator feature.`;
    }
    
    if (lowerQuery.includes('video') || lowerQuery.includes('completion')) {
      return `Video engagement analysis shows strong performance:

🎥 **Top Performing Videos:**
1. "Getting Started Guide" - 85% completion rate (1,200 views)
2. "Advanced Calculator Features" - 78% completion rate (890 views)
3. "Document Upload Tutorial" - 72% completion rate (650 views)

**Key Insights:**
- Average watch time: 4.2 minutes (+18 seconds vs last week)
- Overall completion rate: 72.8% (+2.3%)
- Mobile completion rates are 8% higher than desktop`;
    }
    
    if (lowerQuery.includes('drop') || lowerQuery.includes('journey')) {
      return `User journey analysis reveals key drop-off points:

🛤️ **Main Drop-off Points:**
1. **Calculator Page** (31% drop-off) - Users leave during complex calculations
2. **Document Upload** (18% drop-off) - File size and format issues
3. **Registration Form** (12% drop-off) - Form complexity concerns

**Recommendations:**
- Simplify calculator interface with progressive disclosure
- Add file format guidance and compression options
- Implement multi-step registration with progress indicators`;
    }
    
    return `I understand you're asking about "${query}". Based on your current analytics data, I can see several interesting patterns. Your user engagement has been trending upward with a 12.5% increase in active users this month. 

Would you like me to dive deeper into any specific metrics or time periods? I can analyze:
- User behavior patterns
- Conversion funnel performance  
- Feature adoption rates
- Struggle signal trends
- Segment-specific insights`;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="amazon-q-chat-overlay">
      <div className="amazon-q-chat">
        <div className="chat-header">
          <div className="chat-title">
            <div className="q-logo">Q</div>
            <div>
              <h3>Amazon Q Analytics Assistant</h3>
              <p>AI-powered insights for your analytics data</p>
            </div>
          </div>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="chat-messages">
          {messages.map((message) => (
            <div key={message.id} className={`message ${message.type}`}>
              <div className="message-content">
                <div className="message-text">{message.content}</div>
              </div>
              <div className="message-timestamp">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="message assistant">
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {suggestedQueries.length > 0 && messages.length === 1 && (
          <div className="suggested-queries">
            <p>Try asking:</p>
            <div className="query-buttons">
              {suggestedQueries.map((query, index) => (
                <button
                  key={index}
                  className="suggested-query-button"
                  onClick={() => handleSendMessage(query)}
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="chat-input">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about your analytics data..."
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim() || isLoading}
            className="send-button"
          >
            ➤
          </button>
        </div>
      </div>

      <style>{`
        .amazon-q-chat-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }

        .amazon-q-chat {
          background: white;
          border-radius: 16px;
          width: 90%;
          max-width: 800px;
          height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        }

        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #e2e8f0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 16px 16px 0 0;
        }

        .chat-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .q-logo {
          width: 40px;
          height: 40px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 18px;
        }

        .chat-title h3 {
          margin: 0;
          font-size: 18px;
        }

        .chat-title p {
          margin: 0;
          font-size: 14px;
          opacity: 0.8;
        }

        .close-button {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          padding: 8px;
          border-radius: 4px;
          transition: background-color 0.2s;
          font-size: 18px;
        }

        .close-button:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .message {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .message.user {
          align-items: flex-end;
        }

        .message.assistant {
          align-items: flex-start;
        }

        .message-content {
          max-width: 80%;
          padding: 12px 16px;
          border-radius: 12px;
          word-wrap: break-word;
        }

        .message.user .message-content {
          background: #667eea;
          color: white;
        }

        .message.assistant .message-content {
          background: #f7fafc;
          color: #2d3748;
          border: 1px solid #e2e8f0;
        }

        .message-text {
          white-space: pre-wrap;
          line-height: 1.5;
        }

        .message-timestamp {
          font-size: 12px;
          color: #718096;
          padding: 0 16px;
        }

        .typing-indicator {
          display: flex;
          gap: 4px;
          align-items: center;
        }

        .typing-indicator span {
          width: 8px;
          height: 8px;
          background: #cbd5e0;
          border-radius: 50%;
          animation: typing 1.4s infinite ease-in-out;
        }

        .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

        @keyframes typing {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }

        .suggested-queries {
          padding: 20px;
          border-top: 1px solid #e2e8f0;
          background: #f7fafc;
        }

        .suggested-queries p {
          margin: 0 0 12px 0;
          font-weight: 500;
          color: #2d3748;
        }

        .query-buttons {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 8px;
        }

        .suggested-query-button {
          padding: 8px 12px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          text-align: left;
          transition: all 0.2s;
        }

        .suggested-query-button:hover {
          background: #667eea;
          color: white;
          border-color: #667eea;
        }

        .chat-input {
          display: flex;
          gap: 12px;
          padding: 20px;
          border-top: 1px solid #e2e8f0;
          background: white;
          border-radius: 0 0 16px 16px;
        }

        .chat-input textarea {
          flex: 1;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          font-size: 14px;
          resize: none;
          font-family: inherit;
        }

        .chat-input textarea:focus {
          outline: none;
          border-color: #667eea;
        }

        .send-button {
          background: #667eea;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 12px 16px;
          cursor: pointer;
          transition: background-color 0.2s;
          font-size: 18px;
        }

        .send-button:hover:not(:disabled) {
          background: #5a67d8;
        }

        .send-button:disabled {
          background: #cbd5e0;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .amazon-q-chat {
            width: 95%;
            height: 90vh;
          }

          .message-content {
            max-width: 90%;
          }

          .query-buttons {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default AmazonQChat;
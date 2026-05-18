import VerificationBadge from './VerificationBadge.jsx';

export default function MessageBubble({ message, isOwn, onReport }) {
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`message-bubble ${isOwn ? 'own' : 'other'}`}>
      <div className="bubble-inner">
        <div className="bubble-header">
          <span className="sender">{message.senderId}</span>
          <span className="time">{time}</span>
        </div>
        <p className="bubble-text">{message.text}</p>
        {!message.verified && (
          <p className="verify-warning">This message could not be verified</p>
        )}
        <div className="bubble-footer">
          <VerificationBadge verified={message.verified} />
          {!isOwn && (
            <button type="button" className="report-btn" onClick={() => onReport(message)} title="Report">
              🚩 Report
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

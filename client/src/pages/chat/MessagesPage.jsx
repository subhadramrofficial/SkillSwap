import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useNotifications } from '../../context/NotificationContext';
import chatService from '../../services/chatService';
import { 
  MessageSquare, 
  Send, 
  Search, 
  User, 
  Clock, 
  Star, 
  ArrowLeftRight, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  Sparkles,
  Wifi,
  WifiOff
} from 'lucide-react';

const MessagesPage = () => {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const { markConversationAsRead, conversationUnreadMap } = useNotifications();
  const [searchParams] = useSearchParams();
  const targetExchangeId = searchParams.get('exchange');
  const targetPartnerId = searchParams.get('partner') || searchParams.get('user');
  const targetConvId = searchParams.get('conversation');

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [error, setError] = useState('');

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Helper to extract partner from conversation object
  const getPartner = (conv) => {
    if (!conv?.participants) return null;
    return conv.participants.find((p) => p && p._id?.toString() !== user?._id?.toString());
  };

  // 1. Fetch conversations on mount
  useEffect(() => {
    fetchConversations();
  }, [targetExchangeId, targetPartnerId, targetConvId]);

  const fetchConversations = async () => {
    try {
      setLoadingConversations(true);
      const res = await chatService.getUserConversations();
      if (res.success && res.data) {
        setConversations(res.data);

        // Find or open targeted conversation
        let targetMatch = null;

        if (targetConvId) {
          targetMatch = res.data.find((c) => c._id === targetConvId);
        } else if (targetPartnerId) {
          targetMatch = res.data.find((c) => {
            const p = getPartner(c);
            return p?._id?.toString() === targetPartnerId.toString();
          });
        } else if (targetExchangeId) {
          targetMatch = res.data.find(
            (c) =>
              c.exchange?._id?.toString() === targetExchangeId ||
              c.exchange === targetExchangeId ||
              (c.exchanges && c.exchanges.some((ex) => (ex._id || ex).toString() === targetExchangeId))
          );
        }

        if (targetMatch) {
          selectConversation(targetMatch);
        } else if (targetExchangeId) {
          initConversationFromExchange(targetExchangeId);
        } else if (targetPartnerId) {
          initConversationFromPartner(targetPartnerId);
        } else if (res.data.length > 0 && !activeConversation) {
          selectConversation(res.data[0]);
        }
      }
    } catch (err) {
      setError(err.message || 'Unable to load conversations.');
    } finally {
      setLoadingConversations(false);
    }
  };

  const initConversationFromExchange = async (exchangeId) => {
    try {
      setLoadingMessages(true);
      const res = await chatService.getConversationByExchange(exchangeId);
      if (res.success && res.data) {
        setActiveConversation(res.data);
        const listRes = await chatService.getUserConversations();
        if (listRes.success && listRes.data) {
          setConversations(listRes.data);
        }
      }
    } catch (err) {
      setError(err.message || 'Unable to initialize chat for this exchange.');
    } finally {
      setLoadingMessages(false);
    }
  };

  const initConversationFromPartner = async (partnerId) => {
    try {
      setLoadingMessages(true);
      const res = await chatService.getConversationByPartner(partnerId);
      if (res.success && res.data) {
        setActiveConversation(res.data);
        const listRes = await chatService.getUserConversations();
        if (listRes.success && listRes.data) {
          setConversations(listRes.data);
        }
      }
    } catch (err) {
      setError(err.message || 'Unable to initialize chat for this partner.');
    } finally {
      setLoadingMessages(false);
    }
  };

  // 2. Select conversation and load message history
  const selectConversation = async (conversation) => {
    setActiveConversation(conversation);
    setMessages([]);
    setError('');

    // Mark conversation read in context and clear locally
    if (conversation?._id) {
      markConversationAsRead(conversation._id);
      setConversations((prev) =>
        prev.map((c) => (c._id === conversation._id ? { ...c, unreadCount: 0 } : c))
      );
    }

    try {
      setLoadingMessages(true);
      const res = await chatService.getMessages(conversation._id);
      if (res.success && res.data) {
        setMessages(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load message history.');
    } finally {
      setLoadingMessages(false);
    }
  };

  // 3. Socket event listener bindings
  useEffect(() => {
    if (!socket || !activeConversation) return;

    const exchangeId = activeConversation.exchange?._id || activeConversation.exchange;
    const conversationId = activeConversation._id;

    // Join room for both conversation and exchange
    if (conversationId) {
      socket.emit('join_conversation', { conversationId });
    }
    if (exchangeId) {
      socket.emit('join_exchange', { exchangeId }, (ack) => {
        if (!ack?.success) {
          console.warn('Socket join acknowledgment notice:', ack?.message);
        }
      });
    }

    // Listen for incoming live messages
    const handleReceiveMessage = (data) => {
      const matchActive =
        (data.conversationId && data.conversationId === activeConversation._id) ||
        (data.exchangeId && exchangeId && data.exchangeId === exchangeId);

      if (matchActive) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === data.message._id)) return prev;
          return [...prev, data.message];
        });
        if (data.conversationId) {
          markConversationAsRead(data.conversationId);
        }
      }

      // Update last message preview and unread counts in conversations list
      setConversations((prev) =>
        prev.map((c) => {
          const cId = c._id;
          const cExId = c.exchange?._id || c.exchange;
          const matches =
            cId === data.conversationId ||
            (data.exchangeId && cExId === data.exchangeId);

          if (matches) {
            const isCurrentActive = activeConversation && activeConversation._id === c._id;
            const senderId = (data.message?.sender?._id || data.message?.sender)?.toString();
            const myId = user?._id?.toString();
            const isFromOther = senderId && myId && senderId !== myId;

            return {
              ...c,
              lastMessage: data.message,
              updatedAt: new Date().toISOString(),
              unreadCount: isCurrentActive ? 0 : (c.unreadCount || 0) + (isFromOther ? 1 : 0),
            };
          }
          return c;
        })
      );
    };

    // Listen for typing events
    const handlePartnerTyping = (data) => {
      if (data.userId !== user?._id) {
        setPartnerTyping(true);
      }
    };

    const handlePartnerStopTyping = (data) => {
      if (data.userId !== user?._id) {
        setPartnerTyping(false);
      }
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('partner_typing', handlePartnerTyping);
    socket.on('partner_stop_typing', handlePartnerStopTyping);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('partner_typing', handlePartnerTyping);
      socket.off('partner_stop_typing', handlePartnerStopTyping);
    };
  }, [socket, activeConversation]);

  // 4. Auto scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partnerTyping]);

  // 5. Handle message dispatch
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageText.trim() || !activeConversation) return;

    const exchangeId = activeConversation.exchange?._id || activeConversation.exchange;
    const conversationId = activeConversation._id;
    const textToSend = messageText.trim();
    setMessageText('');

    // Emit stop typing
    if (socket && isConnected) {
      socket.emit('stop_typing', { exchangeId, conversationId });
    }

    if (socket && isConnected) {
      socket.emit('send_message', {
        exchangeId,
        conversationId,
        text: textToSend,
      }, (ack) => {
        if (!ack?.success) {
          setError(ack?.message || 'Failed to send message via live connection.');
        }
      });
    } else {
      // REST fallback if socket disconnected
      chatService
        .sendMessage(exchangeId || conversationId, textToSend)
        .then((res) => {
          if (res.success && res.data) {
            setMessages((prev) => [...prev, res.data]);
          }
        })
        .catch((err) => {
          setError(err.message || 'Failed to send message.');
        });
    }
  };

  // 6. Handle input typing indicator
  const handleInputChange = (e) => {
    setMessageText(e.target.value);

    if (!socket || !isConnected || !activeConversation) return;
    const exchangeId = activeConversation.exchange?._id || activeConversation.exchange;
    const conversationId = activeConversation._id;

    socket.emit('typing', { exchangeId, conversationId });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { exchangeId, conversationId });
    }, 1500);
  };

  const currentPartner = getPartner(activeConversation);

  // Guarantee strictly 1 conversation item per partner in the chat list
  const uniqueConversations = [];
  const seenPartnerIds = new Set();
  for (const conv of conversations) {
    const partner = getPartner(conv);
    if (!partner?._id) continue;
    const pid = partner._id.toString();
    if (!seenPartnerIds.has(pid)) {
      seenPartnerIds.add(pid);
      uniqueConversations.push(conv);
    }
  }

  // Filter conversations by search
  const filteredConversations = uniqueConversations.filter((conv) => {
    const p = getPartner(conv);
    if (!p) return false;
    return (
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.exchange?.offeredSkill?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.exchange?.requestedSkill?.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 flex flex-col">
      {/* Discord-style Dual Pane Container */}
      <div className="flex-1 min-h-[75vh] max-h-[82vh] bg-slate-900/70 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl flex flex-col md:flex-row">
        
        {/* Left Pane: Conversations Sidebar */}
        <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col bg-slate-950/60">
          {/* Sidebar Header & Search */}
          <div className="p-4 border-b border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-base text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-400" />
                Conversations
              </h2>
              <div
                className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isConnected
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
                title={isConnected ? 'Live WebSocket Connected' : 'Disconnected - Reconnecting'}
              >
                {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isConnected ? 'Online' : 'Offline'}
              </div>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
            {loadingConversations ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                <span className="text-xs">Loading conversations...</span>
              </div>
            ) : filteredConversations.length > 0 ? (
              filteredConversations.map((conv) => {
                const partner = getPartner(conv);
                const isSelected = activeConversation?._id === conv._id;
                const unreadCount =
                  typeof conversationUnreadMap[conv._id] === 'number'
                    ? conversationUnreadMap[conv._id]
                    : conv.unreadCount || 0;

                return (
                  <button
                    key={conv._id}
                    onClick={() => selectConversation(conv)}
                    className={`w-full p-4 flex items-start gap-3 text-left transition-colors ${
                      isSelected
                        ? 'bg-slate-800/80 border-l-4 border-emerald-400'
                        : 'hover:bg-slate-900/60'
                    }`}
                  >
                    {partner?.profileImage ? (
                      <img
                        src={partner.profileImage}
                        alt={partner.name}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-700 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-bold text-sm shrink-0">
                        {partner?.name?.charAt(0) || <User className="w-4 h-4" />}
                      </div>
                    )}

                    <div className="flex-1 min-h-[40px] flex flex-col justify-between overflow-hidden">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-white truncate">
                          {partner?.name}
                        </span>
                        {conv.lastMessage && (
                          <span className="text-[10px] text-slate-500 shrink-0">
                            {new Date(conv.lastMessage.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-[11px] truncate flex-1 ${unreadCount > 0 ? 'text-white font-medium' : 'text-slate-400'}`}>
                          {conv.lastMessage
                            ? conv.lastMessage.text
                            : 'No messages yet — start chatting!'}
                        </p>
                        {unreadCount > 0 && (
                          <span
                            className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black bg-emerald-500 text-slate-950 shadow-sm shrink-0"
                            title={`${unreadCount} unread message${unreadCount === 1 ? '' : 's'}`}
                          >
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </div>

                      {conv.exchange && (
                        <div className="flex items-center gap-1 text-[10px] text-emerald-400/80 truncate pt-1">
                          <ArrowLeftRight className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">
                            {conv.exchange?.offeredSkill?.title} ↔ {conv.exchange?.requestedSkill?.title}
                          </span>
                        </div>
                      )}

                      {conv.exchanges && conv.exchanges.length > 1 && (
                        <div className="pt-0.5">
                          <span className="inline-block text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
                            Persistent History ({conv.exchanges.length} exchanges)
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-8 text-center space-y-2">
                <p className="text-xs text-slate-400">No active conversations found.</p>
                <Link
                  to="/exchanges"
                  className="inline-block text-[11px] font-semibold text-emerald-400 hover:underline"
                >
                  View your exchanges
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Active Chat Window */}
        {activeConversation && currentPartner ? (
          <div className="flex-1 flex flex-col bg-slate-900/40">
            {/* Chat Header */}
            <div className="p-4 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <div className="flex items-center gap-3">
                {currentPartner.profileImage ? (
                  <img
                    src={currentPartner.profileImage}
                    alt={currentPartner.name}
                    className="w-10 h-10 rounded-2xl object-cover border border-slate-700"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-bold text-sm">
                    {currentPartner.name?.charAt(0) || <User className="w-4 h-4" />}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/profile/${currentPartner._id}`}
                      className="font-bold text-sm text-white hover:text-emerald-400 transition-colors"
                    >
                      {currentPartner.name}
                    </Link>
                    {currentPartner.averageRating > 0 && (
                      <span className="flex items-center gap-0.5 text-[11px] text-amber-400">
                        <Star className="w-3 h-3 fill-amber-400" />
                        {currentPartner.averageRating.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="capitalize">{currentPartner.availability || 'Flexible'} schedule</span>
                    <span>•</span>
                    <Link
                      to={`/exchanges`}
                      className="text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      View Exchange Status
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div className="m-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Messages Scroll Area */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {loadingMessages ? (
                <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                  <span className="text-xs">Loading message stream...</span>
                </div>
              ) : messages.length > 0 ? (
                messages.map((msg) => {
                  const isMe = msg.sender?._id?.toString() === user?._id?.toString();

                  return (
                    <div
                      key={msg._id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-[10px] font-semibold text-slate-400">
                          {isMe ? 'You' : msg.sender?.name}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div
                        className={`max-w-md px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                          isMe
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-none shadow-md shadow-emerald-500/10'
                            : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700/60'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              ) : (
                /* Empty Chat Screen */
                <div className="py-20 text-center space-y-3 max-w-sm mx-auto">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center mx-auto text-emerald-400">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-white text-sm">Start your learning exchange!</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Say hello to {currentPartner.name}, discuss your learning goals, and schedule your first peer study session.
                  </p>
                </div>
              )}

              {/* Typing indicator */}
              {partnerTyping && (
                <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                  <span className="text-[11px] italic">{currentPartner.name} is typing...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Message Input Bar */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  maxLength={2000}
                  value={messageText}
                  onChange={handleInputChange}
                  placeholder={`Message ${currentPartner.name}...`}
                  className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!messageText.trim()}
                  className="p-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all shadow-md shadow-emerald-500/20 disabled:opacity-40 disabled:pointer-events-none hover:scale-105"
                  title="Send message"
                >
                  <Send className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Empty Active Conversation View */
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-400">
              <MessageSquare className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="font-bold text-lg text-white">Select a conversation to start chatting</h3>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              Choose an accepted partner from the left sidebar or visit your active exchanges to start communicating.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesPage;

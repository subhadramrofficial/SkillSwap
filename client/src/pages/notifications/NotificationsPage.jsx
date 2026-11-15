import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import {
  Bell,
  CheckCheck,
  Check,
  Sparkles,
  Coffee,
  ArrowLeftRight,
  Filter,
  ExternalLink,
  Clock,
  Layers,
  Inbox
} from 'lucide-react';

const NotificationsPage = () => {
  const navigate = useNavigate();
  const {
    notifications,
    loadingNotifications,
    totalUnread,
    markAllAsRead,
    markSingleAsRead,
    fetchNotifications,
  } = useNotifications();

  const [activeTab, setActiveTab] = useState('all');

  const formatTimeAgo = (date) => {
    if (!date) return '';
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  };

  const filteredNotifications = notifications.filter((notif) => {
    if (activeTab === 'unread') return !notif.isRead;
    if (activeTab === 'matches') return notif.type === 'new_match';
    if (activeTab === 'gifts') return notif.type === 'coffee_gift';
    if (activeTab === 'exchanges') return notif.type?.startsWith('exchange_');
    return true;
  });

  const unreadMatchesCount = notifications.filter((n) => !n.isRead && n.type === 'new_match').length;
  const unreadGiftsCount = notifications.filter((n) => !n.isRead && n.type === 'coffee_gift').length;
  const unreadExchangesCount = notifications.filter((n) => !n.isRead && n.type?.startsWith('exchange_')).length;

  const handleNotificationClick = (notif) => {
    if (!notif.isRead) {
      markSingleAsRead(notif._id);
    }
    const isNewMatch = notif.type === 'new_match';
    const isCoffeeGift = notif.type === 'coffee_gift';
    const targetLink = notif.link || (isNewMatch ? '/find-partners' : isCoffeeGift ? '/gift-money' : '/exchanges');
    navigate(targetLink);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800/80 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/5">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Notifications
              </h1>
              {totalUnread > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-xs font-black shadow-md shadow-emerald-500/20">
                  {totalUnread > 99 ? '99+' : totalUnread} unread
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Stay updated on skill matches, coffee gifts, and collaboration requests in real-time.
            </p>
          </div>
        </div>

        {totalUnread > 0 && (
          <button
            type="button"
            onClick={markAllAsRead}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-emerald-400 hover:text-emerald-300 text-xs font-bold transition-all shadow-sm focus:outline-none"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'all'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-400">
            {notifications.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('unread')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'unread'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Unread</span>
          {totalUnread > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px]">
              {totalUnread}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('matches')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'matches'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Skill Matches</span>
          {unreadMatchesCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px]">
              {unreadMatchesCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gifts')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'gifts'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
          }`}
        >
          <Coffee className="w-3.5 h-3.5" />
          <span>Coffee Gifts</span>
          {unreadGiftsCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 text-[10px]">
              {unreadGiftsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('exchanges')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'exchanges'
              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
          }`}
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>Exchanges</span>
          {unreadExchangesCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-400 text-[10px]">
              {unreadExchangesCount}
            </span>
          )}
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loadingNotifications ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800">
            <div className="w-8 h-8 mx-auto border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400 mt-3 font-medium">Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-400">
              <Inbox className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-slate-200">No notifications found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {activeTab === 'unread'
                ? "You have caught up with all your notifications! There are no unread alerts."
                : "You don't have any notifications in this category right now."}
            </p>
          </div>
        ) : (
          filteredNotifications.map((item) => {
            const isNewMatch = item.type === 'new_match';
            const isCoffeeGift = item.type === 'coffee_gift';
            const isExchange = item.type?.startsWith('exchange_');

            return (
              <div
                key={item._id}
                className={`group relative p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex items-start gap-4 ${
                  !item.isRead
                    ? 'bg-slate-900/90 border-slate-700/80 hover:border-emerald-500/40 shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500/10'
                    : 'bg-slate-900/40 border-slate-800/60 hover:bg-slate-800/40 hover:border-slate-700/60'
                }`}
              >
                {/* Type Icon */}
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-md ${
                    isNewMatch
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : isCoffeeGift
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                  }`}
                >
                  {isNewMatch ? (
                    <Sparkles className="w-5 h-5" />
                  ) : isCoffeeGift ? (
                    <Coffee className="w-5 h-5" />
                  ) : (
                    <ArrowLeftRight className="w-5 h-5" />
                  )}
                </div>

                {/* Content */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => handleNotificationClick(item)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <h4 className={`text-sm font-bold truncate ${!item.isRead ? 'text-white' : 'text-slate-300'}`}>
                        {item.title || (isNewMatch ? 'New Skill Match' : isCoffeeGift ? 'Coffee Gift' : 'Exchange Update')}
                      </h4>
                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      )}
                    </div>
                    <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {formatTimeAgo(item.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                    {item.message}
                  </p>

                  <div className="flex items-center gap-3 mt-3">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 group-hover:text-emerald-300 transition-colors">
                      <span>{isNewMatch ? 'Explore Partners' : isCoffeeGift ? 'View Coffee Gifts' : 'View Exchange'}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>

                {/* Action Controls */}
                <div className="flex items-center gap-1 shrink-0 self-start">
                  {!item.isRead && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        markSingleAsRead(item._id);
                      }}
                      title="Mark as read"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;

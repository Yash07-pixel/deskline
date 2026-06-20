import { Bell } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { getNotifications, markNotificationRead } from "../api/client";
import type { EmployeeNotification } from "../types";

const employeeNameKey = "deskline.employeeName";

export function AppNav() {
  const navigate = useNavigate();
  const [employeeName, setEmployeeName] = useState(() => localStorage.getItem(employeeNameKey) ?? "");
  const [notifications, setNotifications] = useState<EmployeeNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = useMemo(() => notifications.filter((notification) => notification.is_read === 0).length, [
    notifications
  ]);

  const refreshNotifications = (name = localStorage.getItem(employeeNameKey) ?? "") => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setNotifications([]);
      return;
    }

    getNotifications(trimmedName)
      .then((items) => setNotifications(items))
      .catch(() => setNotifications([]));
  };

  useEffect(() => {
    const syncName = () => {
      const name = localStorage.getItem(employeeNameKey) ?? "";
      setEmployeeName(name);
      refreshNotifications(name);
    };

    window.addEventListener("deskline:name-updated", syncName);
    window.addEventListener("deskline:notifications-refresh", syncName);
    window.addEventListener("storage", syncName);

    return () => {
      window.removeEventListener("deskline:name-updated", syncName);
      window.removeEventListener("deskline:notifications-refresh", syncName);
      window.removeEventListener("storage", syncName);
    };
  }, []);

  useEffect(() => {
    if (!employeeName.trim()) {
      setNotifications([]);
      return;
    }

    refreshNotifications(employeeName);
    const intervalId = window.setInterval(() => refreshNotifications(employeeName), 10_000);
    const onFocus = () => refreshNotifications(employeeName);

    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [employeeName]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const handleNotificationClick = async (notification: EmployeeNotification) => {
    try {
      const updated = await markNotificationRead(notification.id);
      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, is_read: updated.is_read } : item))
      );
    } catch {
      // Navigation still helps the employee even if the read marker fails.
    }

    setIsOpen(false);
    navigate(`/my-tickets?ticket=${notification.ticket_id}`);
  };

  return (
    <header className="top-nav">
      <NavLink to="/raise-ticket" className="brand">
        Deskline
      </NavLink>
      <nav className="nav-links" aria-label="Main navigation">
        <NavLink className="nav-link" to="/raise-ticket">
          Raise Ticket
        </NavLink>
        <NavLink className="nav-link" to="/my-tickets">
          My Tickets
        </NavLink>
        <NavLink className="nav-link" to="/agent">
          Agent
        </NavLink>
        <NavLink className="nav-link" to="/analytics">
          Analytics
        </NavLink>
      </nav>
      <div className="notification-area" ref={menuRef}>
        <button
          className="icon-button"
          type="button"
          aria-label="Notifications"
          onClick={() => {
            refreshNotifications(employeeName);
            setIsOpen((current) => !current);
          }}
        >
          <Bell size={20} aria-hidden="true" />
          {unreadCount > 0 ? <span className="count-badge">{unreadCount}</span> : null}
        </button>
        {isOpen ? (
          <div className="notification-menu">
            {employeeName.trim() ? (
              notifications.length > 0 ? (
                notifications.map((notification) => (
                  <button
                    className={`notification-item${notification.is_read === 0 ? " unread" : ""}`}
                    key={notification.id}
                    type="button"
                    onClick={() => void handleNotificationClick(notification)}
                  >
                    <div>{notification.message}</div>
                    <div className="hint">{notification.ticket_title}</div>
                  </button>
                ))
              ) : (
                <div className="notification-empty">No notifications yet.</div>
              )
            ) : (
              <div className="notification-empty">Enter your name on the form to see notifications.</div>
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
}

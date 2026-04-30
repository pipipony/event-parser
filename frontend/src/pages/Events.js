import React, { useState, useEffect } from 'react';
import { eventsAPI, ticketsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Events = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const response = await eventsAPI.getEvents();
      setEvents(response.data);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const registerForEvent = async (eventId) => {
    if (!user) {
      alert('Необходимо войти в систему');
      return;
    }

    try {
      await ticketsAPI.createTicket({
        event_id: eventId,
        user_id: 1 // В реальном приложении это будет ID текущего пользователя
      });
      alert('Успешная регистрация на событие!');
      loadEvents(); // Обновляем список событий
    } catch (error) {
      alert('Ошибка регистрации: ' + (error.response?.data?.detail || 'Unknown error'));
    }
  };

  if (loading) return <div>Загрузка...</div>;

  return (
    <div className="events">
      <h1>События</h1>
      <div className="events-list">
        {events.map(event => (
          <div key={event.id} className="event-card">
            <h3>{event.title}</h3>
            <p>{event.description}</p>
            <p><strong>Дата:</strong> {new Date(event.date).toLocaleString()}</p>
            <p><strong>Место:</strong> {event.location}</p>
            <p><strong>Цена:</strong> {event.price} руб.</p>
            <p><strong>Участников:</strong> {event.current_attendees}/{event.max_attendees || '∞'}</p>
            <button 
              onClick={() => registerForEvent(event.id)}
              disabled={event.current_attendees >= (event.max_attendees || Infinity)}
            >
              Зарегистрироваться
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Events;
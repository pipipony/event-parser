import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { eventsAPI, ticketsAPI, usersAPI, weatherAPI } from '../services/api';
import usePageMeta from '../hooks/usePageMeta';

const CATEGORIES = ['Концерт', 'Театр', 'Выставка', 'Кино', 'Стендап', 'Фестиваль', 'Спорт', 'Другое'];

const WeatherWidget = ({ city }) => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!city) return;
    setLoading(true);
    weatherAPI.getWeather(city)
      .then(r => setWeather(r.data))
      .catch(() => setWeather(null))
      .finally(() => setLoading(false));
  }, [city]);

  if (!city || loading) return null;
  if (!weather || weather.error) return null;

  return (
    <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '8px' }}>
      {weather.temperature}°C, {weather.description}
    </span>
  );
};

const EventCard = ({ event, user, onRegister }) => {
  const [imgError, setImgError] = useState(false);

  const getEventEmoji = () => {
    const title = event.title?.toLowerCase() || '';
    if (title.includes('рок') || title.includes('концерт')) return '🎸';
    if (title.includes('стендап') || title.includes('юмор')) return '🎤';
    if (title.includes('джаз')) return '🎷';
    if (title.includes('театр')) return '🎭';
    if (title.includes('кино')) return '🎬';
    if (title.includes('выставка')) return '🖼️';
    return '🎉';
  };

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const isFull = event.current_attendees >= (event.max_attendees || Infinity);

  return (
    <div className="event-card">
      <div className="event-image">
        {event.poster_url && !imgError ? (
          <img
            src={event.poster_url.startsWith('/static') ? `http://localhost:8000${event.poster_url}` : event.poster_url}
            alt={event.title}
            loading="lazy"
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
          />
        ) : (
          <span style={{ fontSize: '3rem' }}>{getEventEmoji()}</span>
        )}
      </div>
      <h3 className="event-title">{event.title}</h3>
      {event.category && (
        <span style={{
          background: '#e2e8ff', color: '#000F60',
          padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem',
          display: 'inline-block', marginBottom: '4px',
        }}>
          {event.category}
        </span>
      )}
      <p className="event-date">{formatDate(event.date)}</p>
      {event.location && (
        <p className="event-date">
          📍 {event.location}
          <WeatherWidget city={event.location} />
        </p>
      )}
      {event.price > 0 && <p className="event-date">💰 {event.price} руб.</p>}
      <p className="event-date">👥 {event.current_attendees}/{event.max_attendees || '∞'}</p>
      <button
        className="go-btn"
        onClick={() => onRegister(event.id)}
        disabled={isFull}
      >
        {isFull ? 'Мест нет' : !user ? 'Войти' : 'Пойти'}
      </button>
    </div>
  );
};

const Home = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAdmin } = useAuth();

  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || '',
    date_from: searchParams.get('date_from') || '',
    date_to: searchParams.get('date_to') || '',
    sort_by: searchParams.get('sort_by') || 'date',
    sort_order: searchParams.get('sort_order') || 'asc',
    page: parseInt(searchParams.get('page') || '1', 10),
    page_size: 9,
  });

  const syncUrlAndLoad = useCallback(async (f) => {
    const params = {};
    if (f.search) params.search = f.search;
    if (f.category) params.category = f.category;
    if (f.date_from) params.date_from = f.date_from;
    if (f.date_to) params.date_to = f.date_to;
    if (f.sort_by !== 'date') params.sort_by = f.sort_by;
    if (f.sort_order !== 'asc') params.sort_order = f.sort_order;
    if (f.page > 1) params.page = f.page;
    setSearchParams(params);

    setLoading(true);
    try {
      const params = {};
      if (f.search)     params.search    = f.search;
      if (f.category)   params.category  = f.category;
      if (f.date_from)  params.date_from = f.date_from + 'T00:00:00';
      if (f.date_to)    params.date_to   = f.date_to   + 'T23:59:59';
      if (f.sort_by)    params.sort_by   = f.sort_by;
      if (f.sort_order) params.sort_order = f.sort_order;
      params.page      = f.page      || 1;
      params.page_size = f.page_size || 9;

      const resp = await eventsAPI.getEvents(params);
      setEvents(resp.data.items);
      setPagination({ total: resp.data.total, pages: resp.data.pages });
    } catch (err) {
      console.error('Ошибка загрузки событий:', err?.response?.data || err.message);
      setEvents([]);
      setPagination({ total: 0, pages: 0 });
    } finally {
      setLoading(false);
    }
  }, [setSearchParams]);

  useEffect(() => {
    syncUrlAndLoad(filters);
  }, []);

  const applyFilters = (newFilters) => {
    const updated = { ...newFilters, page: 1 };
    setFilters(updated);
    syncUrlAndLoad(updated);
  };

  const handleFilterChange = (e) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    applyFilters(filters);
  };

  const handleCategoryClick = (cat) => {
    const next = { ...filters, category: filters.category === cat ? '' : cat };
    applyFilters(next);
  };

  const handleSortChange = (e) => {
    const [sort_by, sort_order] = e.target.value.split('_');
    const next = { ...filters, sort_by, sort_order };
    applyFilters(next);
  };

  const handlePageChange = (newPage) => {
    const next = { ...filters, page: newPage };
    setFilters(next);
    syncUrlAndLoad(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRegister = async (eventId) => {
    if (!user) { navigate('/login'); return; }
    try {
      const userResp = await usersAPI.getMe();
      await ticketsAPI.createTicket({ event_id: eventId, user_id: userResp.data.id });
      alert('Успешная регистрация на событие!');
      syncUrlAndLoad(filters);
    } catch (error) {
      alert('Ошибка: ' + (error.response?.data?.detail || error.message));
    }
  };

  usePageMeta({
    title: 'Афиша мероприятий',
    description: 'Находите концерты, спектакли, выставки и другие события вашего города.',
    url: window.location.href,
  });

  const inputStyle = {
    padding: '8px 12px', border: '2px solid #e0e0e0', borderRadius: '8px',
    fontSize: '0.9rem', outline: 'none',
  };

  return (
    <div className="home">

      <nav className="navbar">
        <div className="logo">aFISHa</div>
        {user ? (
          <div className="user-menu">
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                style={{
                  background: 'transparent', color: '#000F60',
                  border: '2px solid #000F60', padding: '6px 12px',
                  borderRadius: '15px', cursor: 'pointer',
                  marginRight: '10px', fontSize: '0.8rem', fontWeight: 'bold',
                }}
              >
                Админка
              </button>
            )}
            <span className="user-name">Привет, {user.username}!</span>
            <div className="user-avatar" onClick={() => navigate('/profile')} title="Профиль">
              {user.username?.charAt(0).toUpperCase() || 'U'}
            </div>
          </div>
        ) : (
          <button className="login-btn" onClick={() => navigate('/login')}>Войти</button>
        )}
      </nav>

      <div className="home-content">
        <h1 className="main-title">Все говорят: Отстань! А ты купи билет!</h1>
        <p className="subtitle">Выберите мероприятие по душе, даже в душе</p>

        <div style={{
          background: 'white', borderRadius: '16px', padding: '1.5rem',
          boxShadow: '0 4px 16px rgba(0,15,96,0.08)', marginBottom: '1.5rem',
          maxWidth: '900px', margin: '0 auto 1.5rem',
        }}>
          <form onSubmit={handleSearch}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <input
                name="search"
                value={filters.search}
                onChange={handleFilterChange}
                placeholder="Поиск мероприятий..."
                style={{ ...inputStyle, flex: '1', minWidth: '180px' }}
              />
              <input
                type="date"
                name="date_from"
                value={filters.date_from}
                onChange={handleFilterChange}
                title="Дата от"
                style={inputStyle}
              />
              <input
                type="date"
                name="date_to"
                value={filters.date_to}
                onChange={handleFilterChange}
                title="Дата до"
                style={inputStyle}
              />
              <select
                onChange={handleSortChange}
                value={`${filters.sort_by}_${filters.sort_order}`}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="date_asc">По дате ↑</option>
                <option value="date_desc">По дате ↓</option>
                <option value="price_asc">По цене ↑</option>
                <option value="price_desc">По цене ↓</option>
                <option value="title_asc">По названию А-Я</option>
                <option value="title_desc">По названию Я-А</option>
              </select>
              <button
                type="submit"
                style={{
                  background: '#000F60', color: 'white',
                  border: 'none', borderRadius: '8px',
                  padding: '8px 20px', cursor: 'pointer', fontWeight: 'bold',
                }}
              >
                Найти
              </button>
              {(filters.search || filters.category || filters.date_from || filters.date_to) && (
                <button
                  type="button"
                  onClick={() => applyFilters({ ...filters, search: '', category: '', date_from: '', date_to: '' })}
                  style={{ ...inputStyle, cursor: 'pointer', color: '#999' }}
                >
                  Сбросить
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryClick(cat)}
                  style={{
                    padding: '4px 14px', borderRadius: '20px', cursor: 'pointer',
                    border: '2px solid #000F60', fontSize: '0.85rem', fontWeight: 'bold',
                    background: filters.category === cat ? '#000F60' : 'transparent',
                    color: filters.category === cat ? 'white' : '#000F60',
                    transition: 'all 0.2s',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </form>
        </div>

        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ color: '#666', fontSize: '0.9rem' }}>
              {loading ? 'Загрузка...' : `Найдено: ${pagination.total} событий`}
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>Загрузка событий...</div>
          ) : events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
              <p style={{ fontSize: '2rem' }}>🎭</p>
              <p>Мероприятия не найдены. Попробуйте изменить фильтры.</p>
            </div>
          ) : (
            <div className="events-grid">
              {events.map(event => (
                <EventCard key={event.id} event={event} user={user} onRegister={handleRegister} />
              ))}
            </div>
          )}

          {pagination.pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '2rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => handlePageChange(filters.page - 1)}
                disabled={filters.page <= 1}
                style={{
                  padding: '8px 16px', border: '2px solid #000F60', borderRadius: '8px',
                  cursor: filters.page <= 1 ? 'not-allowed' : 'pointer',
                  background: 'transparent', color: '#000F60', opacity: filters.page <= 1 ? 0.4 : 1,
                }}
              >
                ← Назад
              </button>

              {Array.from({ length: pagination.pages }, (_, i) => i + 1)
                .filter(p => Math.abs(p - filters.page) <= 2)
                .map(p => (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    style={{
                      padding: '8px 14px', border: '2px solid #000F60', borderRadius: '8px',
                      cursor: 'pointer', fontWeight: 'bold',
                      background: p === filters.page ? '#000F60' : 'transparent',
                      color: p === filters.page ? 'white' : '#000F60',
                    }}
                  >
                    {p}
                  </button>
                ))}

              <button
                onClick={() => handlePageChange(filters.page + 1)}
                disabled={filters.page >= pagination.pages}
                style={{
                  padding: '8px 16px', border: '2px solid #000F60', borderRadius: '8px',
                  cursor: filters.page >= pagination.pages ? 'not-allowed' : 'pointer',
                  background: 'transparent', color: '#000F60',
                  opacity: filters.page >= pagination.pages ? 0.4 : 1,
                }}
              >
                Вперёд →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;

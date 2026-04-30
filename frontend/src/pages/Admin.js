import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { eventsAPI, aiAPI } from '../services/api';

const Admin = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingEvent, setEditingEvent] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    date: '',
    location: '',
    price: '',
    category: ''
  });

  // Состояния для создания события
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [newEventForm, setNewEventForm] = useState({
    title: '',
    description: '',
    date: '',
    location: '',
    price: '',
    category: '',
    max_attendees: ''
  });

  // Состояния для парсера афиш
  const [parsing, setParsing] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [parseError, setParseError] = useState('');

  // Единый стиль для всех кнопок
  const buttonStyle = {
    background: 'transparent',
    color: '#000F60',
    border: '2px solid #000F60',
    padding: '8px 16px',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    transition: 'all 0.3s ease',
    margin: '0 5px'
  };

  const primaryButtonStyle = {
    ...buttonStyle,
    background: '#000F60',
    color: 'white'
  };

  const dangerButtonStyle = {
    ...buttonStyle,
    background: '#ff4757',
    color: 'white',
    border: '2px solid #ff4757',
    padding: '8px 12px',
    fontSize: '0.8rem'
  };

  const editButtonStyle = {
    ...buttonStyle,
    background: '#17a2b8',
    color: 'white',
    border: '2px solid #17a2b8',
    padding: '8px 12px',
    fontSize: '0.8rem'
  };

  const successButtonStyle = {
    ...buttonStyle,
    background: '#28a745',
    color: 'white',
    border: '2px solid #28a745',
    padding: '8px 12px',
    fontSize: '0.8rem'
  };

  // Проверка прав доступа - если не админ, перенаправляем на главную
  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    if (!isAdmin) {
      navigate('/');
      return;
    }
    
    loadEvents();
  }, [user, isAdmin, navigate]);

  const posterInputRef = useRef(null);
  const [uploadingPoster, setUploadingPoster] = useState(null);

  const loadEvents = async () => {
    try {
      setError('');
      const response = await eventsAPI.getEvents({ page_size: 100 });
      setEvents(response.data.items);
    } catch (error) {
      console.error('Ошибка загрузки событий:', error);
      setError('Не удалось загрузить события. Проверьте подключение к бэкенду.');
    } finally {
      setLoading(false);
    }
  };

  const uploadPoster = async (eventId, file) => {
    if (!file) return;
    setUploadingPoster(eventId);
    try {
      await eventsAPI.uploadPoster(eventId, file);
      loadEvents();
    } catch (e) {
      alert('Ошибка загрузки постера: ' + (e.response?.data?.detail || e.message));
    } finally {
      setUploadingPoster(null);
    }
  };

  const deletePoster = async (eventId) => {
    try {
      await eventsAPI.deletePoster(eventId);
      loadEvents();
    } catch (e) {
      alert('Ошибка удаления постера');
    }
  };

  const setEventStatus = async (eventId, status) => {
    try {
      await eventsAPI.updateEvent(eventId, { status });
      loadEvents();
    } catch (e) {
      alert('Ошибка смены статуса: ' + (e.response?.data?.detail || e.message));
    }
  };

  const deleteEvent = async (eventId) => {
    if (!window.confirm('Вы уверены, что хотите удалить это событие?')) {
      return;
    }

    try {
      await eventsAPI.deleteEvent(eventId);
      setEvents(events.filter(e => e.id !== eventId));
      alert('Событие удалено!');
    } catch (error) {
      console.error('Delete error:', error);
      if (error.response?.status === 401) {
        alert('Ошибка авторизации. Войдите в систему заново.');
        navigate('/login');
      } else if (error.response?.status === 403) {
        alert('Недостаточно прав для удаления этого события.');
      } else {
        alert('Ошибка удаления: ' + (error.response?.data?.detail || 'Неизвестная ошибка'));
      }
    }
  };

  const startEditing = (event) => {
    setEditingEvent(event.id);
    setEditForm({
      title: event.title || '',
      description: event.description || '',
      date: event.date ? event.date.slice(0, 16) : '',
      location: event.location || '',
      price: event.price || '',
      category: event.category || ''
    });
  };

  const cancelEditing = () => {
    setEditingEvent(null);
    setEditForm({
      title: '',
      description: '',
      date: '',
      location: '',
      price: '',
      category: ''
    });
  };

  const handleEditChange = (e) => {
    setEditForm({
      ...editForm,
      [e.target.name]: e.target.value
    });
  };

  const handleNewEventChange = (e) => {
    setNewEventForm({
      ...newEventForm,
      [e.target.name]: e.target.value
    });
  };

  const updateEvent = async (eventId) => {
    try {
      console.log('🟡 Начало обновления события ID:', eventId);

      // Валидация обязательных полей
      if (!editForm.title.trim()) {
        alert('Название события обязательно для заполнения');
        return;
      }
      if (!editForm.location.trim()) {
        alert('Место проведения обязательно для заполнения');
        return;
      }
      if (!editForm.date) {
        alert('Дата и время обязательны для заполнения');
        return;
      }

      // Используем ТОЛЬКО те поля, которые есть в Swagger
      const updateData = {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        date: new Date(editForm.date).toISOString(),
        location: editForm.location.trim(),
        price: parseFloat(editForm.price) || 0,
        category: editForm.category.trim() || null,
        status: "approved"
      };

      console.log('🔧 Отправляемые данные для обновления:', updateData);

      await eventsAPI.updateEvent(eventId, updateData);
      
      alert('✅ Событие успешно обновлено!');
      setEditingEvent(null);
      loadEvents();
      
    } catch (error) {
      console.error('❌ Ошибка обновления:', error);
      
      let errorMessage = 'Неизвестная ошибка';
      if (error.message) {
        errorMessage = error.message;
      }
      
      alert('❌ Ошибка обновления: ' + errorMessage);
    }
  };

  const createNewEvent = async () => {
    try {
      // Валидация обязательных полей
      if (!newEventForm.title.trim()) {
        alert('Название события обязательно для заполнения');
        return;
      }
      if (!newEventForm.location.trim()) {
        alert('Место проведения обязательно для заполнения');
        return;
      }
      if (!newEventForm.date) {
        alert('Дата и время обязательны для заполнения');
        return;
      }
      if (!newEventForm.max_attendees || parseInt(newEventForm.max_attendees) <= 0) {
        alert('Укажите максимальное количество участников');
        return;
      }

      const eventData = {
        title: newEventForm.title.trim(),
        description: newEventForm.description.trim(),
        date: new Date(newEventForm.date).toISOString(),
        location: newEventForm.location.trim(),
        price: parseFloat(newEventForm.price) || 0,
        category: newEventForm.category.trim() || 'Концерт',
        max_attendees: parseInt(newEventForm.max_attendees),
        status: "approved"
      };

      console.log('🔧 Создание нового события:', eventData);

      await eventsAPI.createEvent(eventData);
      
      alert('✅ Событие успешно создано!');
      setCreatingEvent(false);
      setNewEventForm({
        title: '',
        description: '',
        date: '',
        location: '',
        price: '',
        category: '',
        max_attendees: ''
      });
      loadEvents();
      
    } catch (error) {
      console.error('❌ Ошибка создания события:', error);
      
      let errorMessage = 'Неизвестная ошибка';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert('❌ Ошибка создания события: ' + errorMessage);
    }
  };

  // Функции для парсера афиш
  const parseImage = async () => {
    if (!imageUrl.trim()) {
      setParseError('Введите URL изображения');
      return;
    }

    setParsing(true);
    setParseError('');
    setParsedData(null);

    try {
      const response = await aiAPI.parseImage(imageUrl);
      setParsedData(response.data);
      setParseError('');
    } catch (error) {
      console.error('Ошибка парсинга:', error);
      setParseError('Не удалось распознать афишу. Проверьте URL или попробуйте другое изображение.');
    } finally {
      setParsing(false);
    }
  };

  const useParsedData = () => {
    if (!parsedData) return;

    setNewEventForm({
      title: parsedData.title || '',
      description: 'Событие создано через парсер афиш',
      date: parsedData.date ? new Date(parsedData.date).toISOString().slice(0, 16) : '',
      location: parsedData.location || '',
      price: parsedData.price || 0,
      category: parsedData.category || 'Концерт',
      max_attendees: '100'
    });

    setCreatingEvent(true);
    setParsedData(null);
    setImageUrl('');
  };

  const createEventFromParsedData = async () => {
    if (!parsedData) return;

    try {
      const maxAttendees = prompt('Введите максимальное количество участников:', '100');
      if (maxAttendees === null) return;

      const eventData = {
        title: parsedData.title || 'Событие из афиши',
        description: 'Событие создано автоматически через парсер афиш',
        date: parsedData.date ? new Date(parsedData.date).toISOString() : new Date().toISOString(),
        location: parsedData.location || 'Место не указано',
        price: parsedData.price || 0,
        category: parsedData.category || 'Концерт',
        max_attendees: parseInt(maxAttendees) || 100,
        status: "approved"
      };

      await eventsAPI.createEvent(eventData);
      alert('✅ Событие создано из афиши!');
      setImageUrl('');
      setParsedData(null);
      loadEvents();
    } catch (error) {
      console.error('Ошибка создания события:', error);
      alert('❌ Ошибка создания события: ' + (error.response?.data?.detail || 'Неизвестная ошибка'));
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'approved': { label: '✅ Опубликовано', color: '#d4edda', textColor: '#155724' },
      'pending':  { label: '⏳ На проверке',  color: '#fff3cd', textColor: '#856404' },
      'rejected': { label: '❌ Отклонено',    color: '#f8d7da', textColor: '#721c24' },
    };
    
    const config = statusConfig[status];
    if (!config) return null;
    
    return (
      <span style={{
        background: config.color,
        color: config.textColor,
        padding: '4px 8px',
        borderRadius: '5px',
        fontSize: '0.8rem',
        fontWeight: 'bold'
      }}>
        {config.label}
      </span>
    );
  };

  // Если не админ, не показываем ничего (useEffect перенаправит)
  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="admin-page">
        <nav className="navbar">
          <div className="logo">aFISHa</div>
          <div className="user-menu">
            <button 
              onClick={() => navigate('/')}
              style={buttonStyle}
            >
              На главную
            </button>
            <span className="user-name">Админ-панель</span>
            <div className="user-avatar">A</div>
          </div>
        </nav>
        <div style={{marginTop: '80px', padding: '2rem', textAlign: 'center'}}>
          <p>Загрузка событий...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <nav className="navbar">
        <div className="logo">aFISHa</div>
        <div className="user-menu">
          <button 
            onClick={() => navigate('/')}
            style={buttonStyle}
          >
            На главную
          </button>
          <span className="user-name">Админ: {user?.username}</span>
          <div className="user-avatar" style={{background: '#000F60'}}>
            {user?.username?.charAt(0).toUpperCase() || 'A'}
          </div>
        </div>
      </nav>

      <div style={{marginTop: '80px', padding: '2rem'}}>
        <div style={{maxWidth: '1000px', margin: '0 auto'}}>
          <div style={{textAlign: 'center', marginBottom: '2rem'}}>
            <h1 style={{color: '#000F60', marginBottom: '0.5rem'}}>Админ-панель</h1>
            <p style={{color: '#666', fontSize: '1.1rem'}}>Управление событиями и парсинг афиш</p>
          </div>

          {/* 🎪 РАЗДЕЛ ПАРСЕРА АФИШ */}
          <div style={{
            background: 'white', 
            borderRadius: '15px', 
            padding: '2rem', 
            boxShadow: '0 5px 15px rgba(0,15,96,0.1)',
            marginBottom: '2rem'
          }}>
            <h2 style={{color: '#000F60', marginBottom: '1.5rem'}}>🎪 Парсер афиш</h2>
            <p style={{color: '#666', marginBottom: '1.5rem'}}>
              Загрузите изображение афиши, и AI модуль автоматически распознает информацию о событии
            </p>

            <div style={{display: 'grid', gap: '1rem', marginBottom: '1.5rem'}}>
              <div>
                <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#000F60'}}>
                  URL изображения афиши:
                </label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/poster.jpg"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '1rem'
                  }}
                />
              </div>
              
              <button 
                onClick={parseImage}
                disabled={parsing}
                style={{
                  ...primaryButtonStyle,
                  opacity: parsing ? 0.6 : 1,
                  cursor: parsing ? 'not-allowed' : 'pointer'
                }}
              >
                {parsing ? '🔍 Анализируем...' : '🎯 Распознать афишу'}
              </button>
            </div>

            {parseError && (
              <div style={{
                background: '#ffeaea',
                color: '#d63031',
                padding: '1rem',
                borderRadius: '10px',
                marginBottom: '1rem',
                border: '1px solid #ff7675'
              }}>
                {parseError}
              </div>
            )}

            {parsedData && (
              <div style={{
                background: '#f8f9ff',
                padding: '1.5rem',
                borderRadius: '10px',
                border: '2px solid #000F60'
              }}>
                <h3 style={{color: '#000F60', marginBottom: '1rem'}}>✅ Распознанные данные:</h3>
                <div style={{display: 'grid', gap: '0.5rem', marginBottom: '1rem'}}>
                  {parsedData.title && (
                    <p><strong>Название:</strong> {parsedData.title}</p>
                  )}
                  {parsedData.date && (
                    <p><strong>Дата:</strong> {formatDate(parsedData.date)}</p>
                  )}
                  {parsedData.location && (
                    <p><strong>Место:</strong> {parsedData.location}</p>
                  )}
                  {parsedData.price && (
                    <p><strong>Цена:</strong> {parsedData.price} руб.</p>
                  )}
                  {parsedData.confidence && (
                    <p><strong>Точность:</strong> {(parsedData.confidence * 100).toFixed(1)}%</p>
                  )}
                </div>
                
                <div style={{display: 'flex', gap: '1rem', flexWrap: 'wrap'}}>
                  <button 
                    onClick={createEventFromParsedData}
                    style={successButtonStyle}
                  >
                    🎉 Создать событие
                  </button>
                  <button 
                    onClick={useParsedData}
                    style={buttonStyle}
                  >
                    ✏️ Использовать для создания
                  </button>
                  <button 
                    onClick={() => setParsedData(null)}
                    style={dangerButtonStyle}
                  >
                    ❌ Очистить
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 📝 РАЗДЕЛ РУЧНОГО СОЗДАНИЯ СОБЫТИЙ */}
          <div style={{
            background: 'white', 
            borderRadius: '15px', 
            padding: '2rem', 
            boxShadow: '0 5px 15px rgba(0,15,96,0.1)',
            marginBottom: '2rem'
          }}>
            <div style={{
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '1.5rem',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <h2 style={{color: '#000F60', margin: 0}}>Создание события вручную</h2>
              <button 
                onClick={() => setCreatingEvent(!creatingEvent)}
                style={creatingEvent ? dangerButtonStyle : successButtonStyle}
              >
                {creatingEvent ? 'Отмена' : 'Создать событие'}
              </button>
            </div>

            {creatingEvent && (
              <div style={{
                background: '#f8f9ff',
                padding: '1.5rem',
                borderRadius: '10px',
                border: '2px solid #000F60'
              }}>
                <h3 style={{color: '#000F60', marginBottom: '1rem'}}>📝 Новое событие</h3>
                <div style={{display: 'grid', gap: '1rem', marginBottom: '1.5rem'}}>
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                    <div>
                      <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#000F60'}}>
                        Название события: *
                      </label>
                      <input
                        type="text"
                        name="title"
                        value={newEventForm.title}
                        onChange={handleNewEventChange}
                        placeholder="Введите название события"
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '2px solid #e0e0e0',
                          borderRadius: '8px',
                          fontSize: '1rem'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#000F60'}}>
                        Макс. участников: *
                      </label>
                      <input
                        type="number"
                        name="max_attendees"
                        value={newEventForm.max_attendees}
                        onChange={handleNewEventChange}
                        placeholder="100"
                        min="1"
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '2px solid #e0e0e0',
                          borderRadius: '8px',
                          fontSize: '1rem'
                        }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#000F60'}}>
                      Описание:
                    </label>
                    <textarea
                      name="description"
                      value={newEventForm.description}
                      onChange={handleNewEventChange}
                      placeholder="Описание события"
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '2px solid #e0e0e0',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        minHeight: '80px',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                  
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                    <div>
                      <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#000F60'}}>
                        Дата и время: *
                      </label>
                      <input
                        type="datetime-local"
                        name="date"
                        value={newEventForm.date}
                        onChange={handleNewEventChange}
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '2px solid #e0e0e0',
                          borderRadius: '8px',
                          fontSize: '1rem'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#000F60'}}>
                        Место: *
                      </label>
                      <input
                        type="text"
                        name="location"
                        value={newEventForm.location}
                        onChange={handleNewEventChange}
                        placeholder="Место проведения"
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '2px solid #e0e0e0',
                          borderRadius: '8px',
                          fontSize: '1rem'
                        }}
                      />
                    </div>
                  </div>
                  
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                    <div>
                      <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#000F60'}}>
                        Цена (руб):
                      </label>
                      <input
                        type="number"
                        name="price"
                        value={newEventForm.price}
                        onChange={handleNewEventChange}
                        placeholder="0"
                        min="0"
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '2px solid #e0e0e0',
                          borderRadius: '8px',
                          fontSize: '1rem'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#000F60'}}>
                        Категория:
                      </label>
                      <input
                        type="text"
                        name="category"
                        value={newEventForm.category}
                        onChange={handleNewEventChange}
                        placeholder="Концерт, выставка, театр..."
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '2px solid #e0e0e0',
                          borderRadius: '8px',
                          fontSize: '1rem'
                        }}
                      />
                    </div>
                  </div>
                </div>
                
                <div style={{display: 'flex', gap: '1rem', justifyContent: 'flex-end'}}>
                  <button 
                    onClick={() => setCreatingEvent(false)}
                    style={buttonStyle}
                  >
                    Отмена
                  </button>
                  <button 
                    onClick={createNewEvent}
                    style={primaryButtonStyle}
                  >
                    🎉 Создать событие
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 📋 РАЗДЕЛ УПРАВЛЕНИЯ СОБЫТИЯМИ */}
          <div style={{
            background: 'white', 
            borderRadius: '15px', 
            padding: '2rem', 
            boxShadow: '0 5px 15px rgba(0,15,96,0.1)'
          }}>
            <div style={{
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '2rem',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <h2 style={{color: '#000F60', margin: 0}}>Все события ({events.length})</h2>
              <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
                <button 
                  onClick={() => navigate('/')}
                  style={buttonStyle}
                >
                  📋 К событиям
                </button>
                <button 
                  onClick={loadEvents}
                  style={primaryButtonStyle}
                >
                  🔄 Обновить
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                background: '#ffeaea',
                color: '#d63031',
                padding: '1rem',
                borderRadius: '10px',
                marginBottom: '1rem',
                textAlign: 'center',
                border: '1px solid #ff7675'
              }}>
                {error}
              </div>
            )}

            <div className="events-list">
              {events.map(event => (
                <div key={event.id} className="event-card" style={{
                  marginBottom: '1.5rem', 
                  textAlign: 'left',
                  background: 'white',
                  border: editingEvent === event.id ? '2px solid #17a2b8' : '2px solid #f0f4ff',
                  borderRadius: '15px',
                  padding: '1.5rem',
                  transition: 'all 0.3s ease',
                  position: 'relative'
                }}>
                  {editingEvent === event.id ? (
                    // Форма редактирования
                    <div>
                      <h3 style={{color: '#17a2b8', marginBottom: '1rem'}}>✏️ Редактирование события</h3>
                      <div style={{display: 'grid', gap: '1rem', marginBottom: '1rem'}}>
                        <div>
                          <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#000F60'}}>
                            Название: *
                          </label>
                          <input
                            type="text"
                            name="title"
                            value={editForm.title}
                            onChange={handleEditChange}
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '2px solid #e0e0e0',
                              borderRadius: '5px',
                              fontSize: '1rem'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#000F60'}}>
                            Описание:
                          </label>
                          <textarea
                            name="description"
                            value={editForm.description}
                            onChange={handleEditChange}
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '2px solid #e0e0e0',
                              borderRadius: '5px',
                              fontSize: '1rem',
                              minHeight: '60px',
                              resize: 'vertical'
                            }}
                          />
                        </div>
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                          <div>
                            <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#000F60'}}>
                              Дата и время: *
                            </label>
                            <input
                              type="datetime-local"
                              name="date"
                              value={editForm.date}
                              onChange={handleEditChange}
                              style={{
                                width: '100%',
                                padding: '8px',
                                border: '2px solid #e0e0e0',
                                borderRadius: '5px',
                                fontSize: '1rem'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#000F60'}}>
                              Место: *
                            </label>
                            <input
                              type="text"
                              name="location"
                              value={editForm.location}
                              onChange={handleEditChange}
                              style={{
                                width: '100%',
                                padding: '8px',
                                border: '2px solid #e0e0e0',
                                borderRadius: '5px',
                                fontSize: '1rem'
                              }}
                            />
                          </div>
                        </div>
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                          <div>
                            <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#000F60'}}>
                              Цена (руб):
                            </label>
                            <input
                              type="number"
                              name="price"
                              value={editForm.price}
                              onChange={handleEditChange}
                              style={{
                                width: '100%',
                                padding: '8px',
                                border: '2px solid #e0e0e0',
                                borderRadius: '5px',
                                fontSize: '1rem'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#000F60'}}>
                              Категория:
                            </label>
                            <input
                              type="text"
                              name="category"
                              value={editForm.category}
                              onChange={handleEditChange}
                              style={{
                                width: '100%',
                                padding: '8px',
                                border: '2px solid #e0e0e0',
                                borderRadius: '5px',
                                fontSize: '1rem'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      <div style={{display: 'flex', gap: '0.5rem', justifyContent: 'flex-end'}}>
                        <button 
                          onClick={cancelEditing}
                          style={buttonStyle}
                        >
                          Отмена
                        </button>
                        <button 
                          onClick={() => updateEvent(event.id)}
                          style={primaryButtonStyle}
                        >
                          💾 Сохранить
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Отображение события
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem'}}>
                      <div style={{flex: 1}}>
                        <h3 style={{color: '#000F60', marginBottom: '0.5rem', fontSize: '1.3rem'}}>
                          {event.title}
                        </h3>
                        <p style={{color: '#666', marginBottom: '0.5rem'}}>
                          <strong>📅</strong> {formatDate(event.date)}
                        </p>
                        <p style={{color: '#666', marginBottom: '0.5rem'}}>
                          <strong>📍</strong> {event.location}
                        </p>
                        <p style={{color: '#666', marginBottom: '0.5rem'}}>
                          <strong>💰</strong> {event.price > 0 ? `${event.price} руб.` : 'Бесплатно'}
                        </p>
                        {event.description && (
                          <p style={{color: '#666', marginBottom: '0.5rem', fontSize: '0.9rem'}}>
                            {event.description}
                          </p>
                        )}
                        
                        <div style={{display: 'flex', gap: '10px', marginTop: '1rem', flexWrap: 'wrap'}}>
                          {getStatusBadge(event.status)}
                          <span style={{
                            background: '#e2e8ff',
                            color: '#000F60',
                            padding: '4px 8px',
                            borderRadius: '5px',
                            fontSize: '0.8rem',
                            fontWeight: 'bold'
                          }}>
                            👥 {event.current_attendees || 0}/{event.max_attendees || '∞'}
                          </span>
                          {event.category && (
                            <span style={{
                              background: '#f0f0f0',
                              color: '#666',
                              padding: '4px 8px',
                              borderRadius: '5px',
                              fontSize: '0.8rem'
                            }}>
                              🏷️ {event.category}
                            </span>
                          )}
                          <span style={{
                            background: '#f0f0f0',
                            color: '#666',
                            padding: '4px 8px',
                            borderRadius: '5px',
                            fontSize: '0.8rem'
                          }}>
                            ID: {event.id}
                          </span>
                        </div>
                      </div>
                      
                      <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '140px'}}>
                        {/* Статус */}
                        {event.status !== 'approved' && (
                          <button
                            onClick={() => setEventStatus(event.id, 'approved')}
                            style={successButtonStyle}
                          >
                            ✅ Опубликовать
                          </button>
                        )}
                        {event.status !== 'rejected' && (
                          <button
                            onClick={() => setEventStatus(event.id, 'rejected')}
                            style={{...dangerButtonStyle, fontSize: '0.8rem'}}
                          >
                            🚫 Отклонить
                          </button>
                        )}
                        {event.status !== 'pending' && (
                          <button
                            onClick={() => setEventStatus(event.id, 'pending')}
                            style={{...buttonStyle, fontSize: '0.8rem'}}
                          >
                            ⏳ В ожидание
                          </button>
                        )}
                        <button
                          onClick={() => startEditing(event)}
                          style={editButtonStyle}
                        >
                          ✏️ Редактировать
                        </button>
                        <button
                          onClick={() => deleteEvent(event.id)}
                          style={dangerButtonStyle}
                        >
                          🗑️ Удалить
                        </button>
                        <label style={{...successButtonStyle, textAlign: 'center', cursor: 'pointer', background: '#6c757d', borderColor: '#6c757d'}}>
                          {uploadingPoster === event.id ? '⏳ Загрузка...' : '🖼️ Постер'}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            style={{display: 'none'}}
                            onChange={e => uploadPoster(event.id, e.target.files[0])}
                          />
                        </label>
                        {event.poster_url && (
                          <button onClick={() => deletePoster(event.id)} style={{...dangerButtonStyle, fontSize: '0.75rem'}}>
                            🗑️ Убрать фото
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {events.length === 0 && !error && (
              <div style={{textAlign: 'center', padding: '3rem', color: '#666'}}>
                <p style={{fontSize: '1.2rem', marginBottom: '1rem'}}>🎭</p>
                <p>Нет событий для управления</p>
                <p style={{fontSize: '0.9rem', marginTop: '0.5rem'}}>Создайте первое событие с помощью парсера афиш или вручную</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;
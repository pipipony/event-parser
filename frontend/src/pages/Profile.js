import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { usersAPI } from '../services/api';

const Profile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      loadTickets();
    }
  }, [user]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await usersAPI.getMyTickets();
      
      console.log('Tickets response:', response.data);

      if (Array.isArray(response.data)) {
        setTickets(response.data);
      } else {
        console.error('Некорректный формат данных билетов:', response.data);
        setTickets([]);
      }
    } catch (error) {
      console.error('Ошибка загрузки билетов:', error);
      setError('Не удалось загрузить билеты');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Дата не указана';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Неверный формат даты';
    }
  };

  const getAvatarLetter = () => {
    return user?.username?.charAt(0).toUpperCase() || 'U';
  };

  const getEventInfo = (ticket) => {
    if (!ticket.event) {
      return {
        title: 'Событие не найдено',
        date: null,
        location: 'Место не указано',
        price: 0,
        hasEvent: false
      };
    }
    
    return {
      title: ticket.event.title || 'Без названия',
      date: ticket.event.date,
      location: ticket.event.location || 'Место не указано',
      price: ticket.event.price || 0,
      hasEvent: true
    };
  };

  return (
    <div className="profile-page">
      <nav className="navbar">
        <div className="logo">aFISHa</div>
        <div className="user-menu">
          <button 
            onClick={() => navigate('/')}
            style={{
              background: 'transparent',
              color: '#000F60',
              border: '2px solid #000F60',
              padding: '8px 16px',
              borderRadius: '20px',
              cursor: 'pointer',
              marginRight: '10px',
              fontSize: '0.9rem'
            }}
          >
            На главную
          </button>
          <span className="user-name">{user?.username}</span>
          <div className="user-avatar">
            {getAvatarLetter()}
          </div>
        </div>
      </nav>

      <div className="profile-content" style={{marginTop: '80px', padding: '2rem'}}>
        <div style={{maxWidth: '800px', margin: '0 auto'}}>
          <div className="auth-form">
            <h2>Мой профиль</h2>
            
            {error && (
              <div style={{
                background: '#ffebee',
                color: '#c62828',
                padding: '10px',
                borderRadius: '5px',
                marginBottom: '1rem',
                textAlign: 'center'
              }}>
                {error}
                <button 
                  onClick={loadTickets}
                  style={{
                    marginLeft: '10px',
                    background: '#000F60',
                    color: 'white',
                    border: 'none',
                    padding: '5px 10px',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  Повторить
                </button>
              </div>
            )}
            
            <div style={{textAlign: 'center', marginBottom: '2rem'}}>
              <div 
                className="user-avatar" 
                style={{width: '80px', height: '80px', fontSize: '2rem', margin: '0 auto'}}
              >
                {getAvatarLetter()}
              </div>
              <h3 style={{marginTop: '1rem', color: '#000F60'}}>{user?.username}</h3>
              <p style={{color: '#666'}}>{user?.email}</p>
            </div>

            <div style={{marginBottom: '2rem'}}>
              <h4 style={{color: '#000F60', marginBottom: '1rem', textAlign: 'center'}}>Мои билеты</h4>
              
              {loading ? (
                <p style={{textAlign: 'center', color: '#666'}}>Загрузка билетов...</p>
              ) : tickets.length > 0 ? (
                <div className="tickets-list">
                  {tickets.map(ticket => {
                    const eventInfo = getEventInfo(ticket);
                    return (
                      <div key={ticket.id} className="event-card" style={{
                        marginBottom: '1rem',
                        textAlign: 'left',
                        background: 'white',
                        border: '2px solid #f0f4ff',
                        borderRadius: '15px',
                        padding: '1.5rem',
                        position: 'relative'
                      }}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                          <div style={{flex: 1}}>
                            <h3 style={{color: '#000F60', marginBottom: '0.5rem'}}>
                              {eventInfo.title}
                            </h3>
                            <p style={{color: '#666', marginBottom: '0.5rem'}}>
                              <strong>📅</strong> {formatDate(eventInfo.date)}
                            </p>
                            <p style={{color: '#666', marginBottom: '0.5rem'}}>
                              <strong>📍</strong> {eventInfo.location}
                            </p>
                            <p style={{color: '#666', marginBottom: '0.5rem'}}>
                              <strong>💰</strong> {eventInfo.price > 0 ? `${eventInfo.price} руб.` : 'Бесплатно'}
                            </p>
                            <p style={{color: '#666', marginBottom: '0.5rem'}}>
                              <strong>🎫</strong> Номер билета: {ticket.ticket_number}
                            </p>
                            <div style={{display: 'flex', gap: '10px', marginTop: '1rem', flexWrap: 'wrap'}}>
                              <span style={{
                                background: ticket.status === 'active' ? '#d4edda' : '#fff3cd',
                                color: ticket.status === 'active' ? '#155724' : '#856404',
                                padding: '4px 8px',
                                borderRadius: '5px',
                                fontSize: '0.8rem',
                                fontWeight: 'bold'
                              }}>
                                {ticket.status === 'active' ? '✅ Активен' : '❌ Использован'}
                              </span>
                              {!eventInfo.hasEvent && (
                                <span style={{
                                  background: '#ffebee',
                                  color: '#c62828',
                                  padding: '4px 8px',
                                  borderRadius: '5px',
                                  fontSize: '0.8rem',
                                  fontWeight: 'bold'
                                }}>
                                  ⚠️ Событие недоступно
                                </span>
                              )}
                            </div>
                          </div>
                          {ticket.qr_code_url && (
                            <div style={{marginLeft: '1rem', textAlign: 'center'}}>
                              <img 
                                src={`http://localhost:8000${ticket.qr_code_url}`} 
                                alt="QR код" 
                                style={{
                                  width: '80px',
                                  height: '80px',
                                  borderRadius: '8px',
                                  border: '2px solid #000F60'
                                }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                              <p style={{fontSize: '0.7rem', color: '#666', marginTop: '5px'}}>QR код</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{textAlign: 'center', padding: '2rem', color: '#666'}}>
                  <p style={{fontSize: '1.2rem', marginBottom: '1rem'}}>🎭</p>
                  <p>У вас пока нет билетов</p>
                  <p style={{fontSize: '0.9rem', marginTop: '0.5rem'}}>Зарегистрируйтесь на мероприятия с главной страницы</p>
                  <button 
                    onClick={() => navigate('/')}
                    style={{
                      marginTop: '1rem',
                      background: '#000F60',
                      color: 'white',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '10px',
                      cursor: 'pointer'
                    }}
                  >
                    Перейти к мероприятиям
                  </button>
                </div>
              )}
            </div>

            <button 
              onClick={handleLogout}
              style={{
                background: '#ff4757',
                color: 'white',
                border: 'none',
                padding: '12px',
                borderRadius: '10px',
                width: '100%',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 'bold',
                marginTop: '1rem'
              }}
            >
              Выйти из аккаунта
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const result = await login(formData.username, formData.password);
      if (result.success) {
        navigate('/');
      } else {
        const errorMessage = result.error?.message ||
                            result.error?.detail || 
                            result.error || 
                            'Произошла ошибка при входе';
        setError(errorMessage);
      }
    } catch (err) {
      const errorMessage = err?.response?.data?.detail ||
                          err?.message || 
                          'Произошла неизвестная ошибка';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-form">
      <h2>Вход</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="username"
          placeholder="Имя пользователя"
          value={formData.username}
          onChange={handleChange}
          required
          disabled={loading}
        />
        <input
          type="password"
          name="password"
          placeholder="Пароль"
          value={formData.password}
          onChange={handleChange}
          required
          disabled={loading}
        />
        {error && (
          <div className="error" style={{
            color: 'red',
            backgroundColor: '#ffe6e6',
            padding: '10px',
            borderRadius: '5px',
            marginBottom: '10px',
            border: '1px solid #ffcccc'
          }}>
            {typeof error === 'string' ? error : JSON.stringify(error)}
          </div>
        )}
        <button 
          type="submit" 
          disabled={loading}
          style={{
            opacity: loading ? 0.6 : 1,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Вход...' : 'Войти'}
        </button>
      </form>
      <p>Нет аккаунта? <Link to="/register">Зарегистрируйтесь</Link></p>
    </div>
  );
};

export default Login;
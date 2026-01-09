import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('adminToken')
      localStorage.removeItem('adminUser')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth
export const login = (email, password) =>
  api.post('/auth/login', { email, password })

// Flights
export const getFlights = (params) =>
  api.get('/flights/admin/list', { params })

export const searchFlights = (params) =>
  api.get('/flights/search', { params })

export const getFlightById = (id) =>
  api.get(`/flights/${id}`)

export const createFlight = (data) =>
  api.post('/flights', data)

export const updateFlight = (id, data) =>
  api.put(`/flights/${id}`, data)

// Airports
export const getAirports = (params) =>
  api.get('/airports', { params })

export const searchAirports = (q) =>
  api.get('/airports/search/autocomplete', { params: { q } })

// Price Prediction
export const predictPrice = (data) =>
  api.post('/predict', data)

export default api

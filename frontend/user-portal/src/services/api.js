import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api-gateway-qz1l.onrender.com/api/v1'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('userToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auth
export const login = (email, password) =>
  api.post('/auth/login', { email, password })

export const register = (data) =>
  api.post('/members/register', data)

export const getProfile = () =>
  api.get('/members/profile')

// Flights
export const searchFlights = (params) =>
  api.get('/flights/search', { params })

export const getFlightById = (id) =>
  api.get(`/flights/${id}`)

// Airports
export const getAirports = () =>
  api.get('/airports')

export const searchAirports = (q) =>
  api.get('/airports/search/autocomplete', { params: { q } })

// Tickets
export const buyTicket = (data) =>
  api.post('/tickets/buy', data)

export const getTicketsByBooking = (bookingRef) =>
  api.get(`/tickets/${bookingRef}`)

export const getMemberTickets = (memberNumber, params) =>
  api.get(`/tickets/member/${memberNumber}`, { params })

export const cancelTicket = (ticketId) =>
  api.post(`/tickets/${ticketId}/cancel`)

// Miles
export const getMilesBalance = () =>
  api.get('/miles/balance')

export const getMilesTransactions = (params) =>
  api.get('/miles/transactions', { params })

export const calculateMiles = (price) =>
  api.get('/miles/calculate', { params: { price } })

export default api

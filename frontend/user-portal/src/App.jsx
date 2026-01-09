import { Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import Home from './pages/Home'
import SearchResults from './pages/SearchResults'
import Booking from './pages/Booking'
import Login from './pages/Login'
import Register from './pages/Register'
import MyBookings from './pages/MyBookings'
import Profile from './pages/Profile'
import { AuthContext } from './context/AuthContext'

function App() {
  const [user, setUser] = useState(null)
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('userToken')
    const userData = localStorage.getItem('userData')
    const memberData = localStorage.getItem('memberData')
    if (token && userData) {
      setUser(JSON.parse(userData))
      if (memberData) {
        setMember(JSON.parse(memberData))
      }
    }
    setLoading(false)
  }, [])

  const login = (userData, memberData, token) => {
    localStorage.setItem('userToken', token)
    localStorage.setItem('userData', JSON.stringify(userData))
    if (memberData) {
      localStorage.setItem('memberData', JSON.stringify(memberData))
      setMember(memberData)
    }
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('userToken')
    localStorage.removeItem('userData')
    localStorage.removeItem('memberData')
    setUser(null)
    setMember(null)
  }

  const updateMember = (newMemberData) => {
    localStorage.setItem('memberData', JSON.stringify(newMemberData))
    setMember(newMemberData)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-turkish-red"></div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, member, login, logout, updateMember }}>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/booking/:flightId" element={<Booking />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/my-bookings" element={<MyBookings />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </Layout>
    </AuthContext.Provider>
  )
}

export default App

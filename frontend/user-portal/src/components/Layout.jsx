import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Plane, User, LogOut, Ticket, Menu, X } from 'lucide-react'
import { useState } from 'react'

function Layout({ children }) {
  const { user, member, logout } = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isHome = location.pathname === '/'

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className={`${isHome ? 'absolute top-0 left-0 right-0 z-50 bg-transparent' : 'bg-turkish-red'}`}>
        <nav className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <Plane className="text-turkish-red" size={24} />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-white font-bold text-lg">Turkish Airlines</h1>
                <p className="text-white/70 text-xs">Widen Your World</p>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6">
              {user ? (
                <>
                  <Link 
                    to="/my-bookings" 
                    className="text-white/80 hover:text-white flex items-center gap-2"
                  >
                    <Ticket size={18} />
                    My Bookings
                  </Link>
                  <Link 
                    to="/profile" 
                    className="text-white/80 hover:text-white flex items-center gap-2"
                  >
                    <User size={18} />
                    {member?.first_name || 'Profile'}
                  </Link>
                  {member && (
                    <div className="bg-white/20 px-4 py-2 rounded-lg">
                      <span className="text-white/80 text-sm">Miles:</span>
                      <span className="text-white font-bold ml-2">
                        {member.available_miles?.toLocaleString() || 0}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={logout}
                    className="text-white/80 hover:text-white flex items-center gap-2"
                  >
                    <LogOut size={18} />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link 
                    to="/login" 
                    className="text-white/80 hover:text-white"
                  >
                    Sign In to Miles&Smiles
                  </Link>
                  <Link 
                    to="/register" 
                    className="bg-white text-turkish-red px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                  >
                    Join Now
                  </Link>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden text-white p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4 border-t border-white/20 pt-4">
              {user ? (
                <div className="space-y-4">
                  <Link 
                    to="/my-bookings" 
                    className="block text-white/80 hover:text-white"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    My Bookings
                  </Link>
                  <Link 
                    to="/profile" 
                    className="block text-white/80 hover:text-white"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Profile
                  </Link>
                  {member && (
                    <div className="text-white">
                      Miles: {member.available_miles?.toLocaleString() || 0}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      logout()
                      setMobileMenuOpen(false)
                    }}
                    className="block text-white/80 hover:text-white"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Link 
                    to="/login" 
                    className="block text-white/80 hover:text-white"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link 
                    to="/register" 
                    className="block text-white/80 hover:text-white"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Join Miles&Smiles
                  </Link>
                </div>
              )}
            </div>
          )}
        </nav>
      </header>

      {/* Main Content */}
      <main className={`flex-1 ${isHome ? '' : 'pt-0'}`}>
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                  <Plane className="text-turkish-red" size={24} />
                </div>
                <span className="font-bold text-lg">Turkish Airlines</span>
              </div>
              <p className="text-gray-400 text-sm">
                Widen Your World. Experience the best of travel with Turkish Airlines.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white">Flight Search</a></li>
                <li><a href="#" className="hover:text-white">Check-in</a></li>
                <li><a href="#" className="hover:text-white">Flight Status</a></li>
                <li><a href="#" className="hover:text-white">Destinations</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Miles&Smiles</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white">Join Now</a></li>
                <li><a href="#" className="hover:text-white">Earn Miles</a></li>
                <li><a href="#" className="hover:text-white">Spend Miles</a></li>
                <li><a href="#" className="hover:text-white">Partner Airlines</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Contact</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>Customer Service: 444 0 849</li>
                <li>Email: info@thy.com</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400 text-sm">
            <p>© 2024 Turkish Airlines. All rights reserved. SE 4458 Final Project.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Layout

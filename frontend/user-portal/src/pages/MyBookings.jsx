import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { getMemberTickets, getTicketsByBooking, cancelTicket } from '../services/api'
import { useSearchParams, Navigate, Link } from 'react-router-dom'
import { Plane, Calendar, Ticket, X, AlertCircle, Check, Search } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

function MyBookings() {
  const { user, member } = useAuth()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [bookingRef, setBookingRef] = useState(searchParams.get('ref') || '')
  const [searchRef, setSearchRef] = useState('')

  // Fetch member's tickets if logged in
  const { data: memberTicketsData, isLoading: loadingMemberTickets } = useQuery({
    queryKey: ['memberTickets', member?.member_number],
    queryFn: () => getMemberTickets(member.member_number, { limit: 20 }),
    enabled: !!member?.member_number,
  })

  // Fetch tickets by booking reference
  const { data: refTicketsData, isLoading: loadingRefTickets, refetch: refetchRef } = useQuery({
    queryKey: ['bookingRef', bookingRef],
    queryFn: () => getTicketsByBooking(bookingRef),
    enabled: !!bookingRef,
  })

  const cancelMutation = useMutation({
    mutationFn: cancelTicket,
    onSuccess: () => {
      queryClient.invalidateQueries(['memberTickets'])
      queryClient.invalidateQueries(['bookingRef'])
      toast.success('Ticket cancelled successfully')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to cancel ticket')
    },
  })

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchRef) {
      setBookingRef(searchRef)
    }
  }

  const handleCancel = (ticketId) => {
    if (confirm('Are you sure you want to cancel this ticket?')) {
      cancelMutation.mutate(ticketId)
    }
  }

  const memberTickets = memberTicketsData?.data?.data?.tickets || []
  const refTickets = refTicketsData?.data?.data?.tickets || []

  // Combine and dedupe tickets
  const allTickets = [...memberTickets]
  refTickets.forEach(t => {
    if (!allTickets.find(mt => mt.id === t.id)) {
      allTickets.push(t)
    }
  })

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">My Bookings</h1>
          <p className="text-gray-500 mb-8">View and manage your flight bookings</p>

          {/* Search by Booking Reference */}
          <div className="card mb-6">
            <h3 className="font-semibold mb-4">Find Booking by Reference</h3>
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={searchRef}
                  onChange={(e) => setSearchRef(e.target.value.toUpperCase())}
                  placeholder="Enter booking reference (e.g., ABC123)"
                  className="input-field pl-11"
                  maxLength={6}
                />
              </div>
              <button type="submit" className="btn-primary">
                Search
              </button>
            </form>
          </div>

          {/* Success message for new booking */}
          {searchParams.get('ref') && refTickets.length > 0 && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-700">
              <Check size={20} />
              <span>Booking {searchParams.get('ref')} confirmed! Details below.</span>
            </div>
          )}

          {/* Tickets List */}
          {(loadingMemberTickets || loadingRefTickets) ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-turkish-red"></div>
            </div>
          ) : allTickets.length === 0 ? (
            <div className="card text-center py-12">
              <Ticket className="mx-auto text-gray-300 mb-4" size={48} />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No bookings found</h3>
              <p className="text-gray-500 mb-6">
                {member 
                  ? "You haven't made any bookings yet."
                  : "Enter a booking reference to view your tickets."}
              </p>
              <Link to="/" className="btn-primary inline-block">
                Search Flights
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {allTickets.map((ticket) => (
                <div key={ticket.id} className="card">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      {/* Booking Reference */}
                      <div className="flex items-center gap-3 mb-3">
                        <span className="bg-turkish-red/10 text-turkish-red px-3 py-1 rounded font-mono font-bold">
                          {ticket.booking_reference}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          ticket.status === 'CONFIRMED'
                            ? 'bg-green-100 text-green-700'
                            : ticket.status === 'CANCELLED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {ticket.status}
                        </span>
                      </div>

                      {/* Flight Info */}
                      <div className="flex items-center gap-6">
                        <div>
                          <p className="text-lg font-bold">{ticket.flight_code}</p>
                          <p className="text-sm text-gray-500">
                            {format(new Date(ticket.departure_date), 'EEE, MMM d, yyyy')}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <p className="font-bold">{ticket.departure_time?.slice(0, 5)}</p>
                            <p className="text-sm text-gray-500">{ticket.from_airport_code}</p>
                          </div>
                          <Plane size={20} className="text-turkish-red" />
                          <div className="text-center">
                            <p className="font-bold">{ticket.arrival_time?.slice(0, 5)}</p>
                            <p className="text-sm text-gray-500">{ticket.to_airport_code}</p>
                          </div>
                        </div>
                      </div>

                      {/* Passenger */}
                      <p className="text-gray-600 mt-2">
                        Passenger: {ticket.passenger_title} {ticket.passenger_first_name} {ticket.passenger_last_name}
                      </p>

                      {/* Ticket Number */}
                      <p className="text-sm text-gray-500 mt-1">
                        Ticket: {ticket.ticket_number}
                      </p>
                    </div>

                    {/* Price & Actions */}
                    <div className="text-right">
                      <p className="text-2xl font-bold text-turkish-red">
                        ${parseFloat(ticket.price_paid).toFixed(2)}
                      </p>
                      {ticket.miles_earned > 0 && (
                        <p className="text-sm text-gray-500">+{ticket.miles_earned} miles</p>
                      )}
                      
                      {ticket.status === 'CONFIRMED' && (
                        <button
                          onClick={() => handleCancel(ticket.id)}
                          disabled={cancelMutation.isPending}
                          className="mt-3 text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1 ml-auto"
                        >
                          <X size={16} />
                          Cancel Ticket
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MyBookings

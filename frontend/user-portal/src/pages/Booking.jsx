import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getFlightById, buyTicket, calculateMiles, getProfile } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { 
  Plane, 
  User, 
  Calendar, 
  Clock, 
  CreditCard,
  Star,
  Check,
  AlertCircle
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

function Booking() {
  const { flightId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, member: contextMember, updateMember } = useAuth()
  const queryClient = useQueryClient()
  
  const passengerCount = parseInt(searchParams.get('passengers') || '1')

  // Fetch latest member data for accurate miles balance
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => getProfile(),
    enabled: !!user,
    retry: 1,
  })

  // Use latest member data from API, fallback to context member
  const member = profileData?.data?.data || contextMember

  // Debug: Log member info
  useEffect(() => {
    console.log('Booking Page - Member Debug:', {
      hasContextMember: !!contextMember,
      hasProfileData: !!profileData?.data?.data,
      member,
      availableMiles: member?.available_miles,
    })
  }, [member, contextMember, profileData])

  const [passengers, setPassengers] = useState(
    Array(passengerCount).fill(null).map(() => ({
      title: 'Mr',
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      email: '',
      phone: '',
    }))
  )

  const [useMiles, setUseMiles] = useState(false)
  const [wantToJoin, setWantToJoin] = useState(false)

  // Fetch flight details
  const { data: flightData, isLoading } = useQuery({
    queryKey: ['flight', flightId],
    queryFn: () => getFlightById(flightId),
  })
  const flight = flightData?.data?.data

  // Pre-fill first passenger if logged in
  useEffect(() => {
    if (member && passengers[0]) {
      setPassengers(prev => {
        const updated = [...prev]
        updated[0] = {
          ...updated[0],
          title: member.title || 'Mr',
          firstName: member.first_name || '',
          lastName: member.last_name || '',
          email: member.email || '',
          dateOfBirth: member.date_of_birth || '',
        }
        return updated
      })
    }
  }, [member])

  // Buy ticket mutation
  const buyMutation = useMutation({
    mutationFn: buyTicket,
    onSuccess: async (response) => {
      const { bookingReference, memberInfo } = response.data.data
      
      // Refresh member data if user is logged in
      if (user) {
        try {
          const profileResponse = await getProfile()
          const updatedMember = profileResponse.data.data.member
          if (updatedMember) {
            updateMember(updatedMember)
          }
        } catch (err) {
          console.error('Failed to refresh member data:', err)
        }
      }
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries(['milesTransactions'])
      
      toast.success('Booking successful!')
      navigate(`/my-bookings?ref=${bookingReference}`)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Booking failed')
    },
  })

  const handlePassengerChange = (index, field, value) => {
    setPassengers(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    // Validate all passengers have required fields
    for (let i = 0; i < passengers.length; i++) {
      if (!passengers[i].firstName || !passengers[i].lastName || !passengers[i].dateOfBirth) {
        toast.error(`Please fill in all required fields for Passenger ${i + 1}`)
        return
      }
    }

    buyMutation.mutate({
      flightId,
      passengers: passengers.map(p => ({
        ...p,
        email: p.email || passengers[0].email, // Use first passenger's email if not provided
      })),
      useMiles: useMiles && member && canPayWithMiles,
      memberNumber: member?.member_number || null,
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-turkish-red"></div>
      </div>
    )
  }

  if (!flight) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <p className="text-red-600">Flight not found</p>
        </div>
      </div>
    )
  }

  const totalPrice = parseFloat(flight.base_price) * passengerCount
  const milesNeeded = Math.floor(totalPrice * 100)
  const milesEarned = Math.floor(totalPrice * 10) * passengerCount
  const availableMiles = member?.available_miles || 0
  const hasMiles = availableMiles > 0
  const hasEnoughMiles = availableMiles >= milesNeeded
  
  const handleMilesChange = (checked) => {
    if (checked) {
      if (!hasMiles) {
        toast.error('You have no miles available')
        return
      }
      if (!hasEnoughMiles) {
        const partialMilesValue = availableMiles / 100
        const remainingPrice = totalPrice - partialMilesValue
        toast.info(`You have ${availableMiles.toLocaleString()} miles. This will cover $${partialMilesValue.toFixed(2)}. Remaining: $${remainingPrice.toFixed(2)}`)
      }
    }
    setUseMiles(checked)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Flight Summary */}
          <div className="card mb-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Plane className="text-turkish-red" />
              Flight Summary
            </h2>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <p className="text-3xl font-bold">{flight.departure_time?.slice(0, 5)}</p>
                  <p className="text-lg font-semibold">{flight.from_airport_code}</p>
                  <p className="text-sm text-gray-500">{flight.from_city}</p>
                </div>
                
                <div className="flex flex-col items-center">
                  <p className="text-sm text-gray-500 mb-2">
                    {Math.floor(flight.duration_minutes / 60)}h {flight.duration_minutes % 60}m
                  </p>
                  <div className="w-32 h-px bg-gray-300 relative">
                    <Plane className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-turkish-red bg-white" size={20} />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    {flight.is_direct ? 'Direct' : 'Connecting'}
                  </p>
                </div>
                
                <div className="text-center">
                  <p className="text-3xl font-bold">{flight.arrival_time?.slice(0, 5)}</p>
                  <p className="text-lg font-semibold">{flight.to_airport_code}</p>
                  <p className="text-sm text-gray-500">{flight.to_city}</p>
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-sm text-gray-500">
                  {format(new Date(flight.departure_date), 'EEE, MMM d, yyyy')}
                </p>
                <p className="text-lg font-semibold text-turkish-red">{flight.flight_code}</p>
              </div>
            </div>
          </div>

          {/* Miles&Smiles Banner */}
          {!user && (
            <div className="bg-gradient-to-r from-turkish-red to-turkish-dark text-white rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Star size={40} />
                  <div>
                    <h3 className="text-xl font-bold">Sign in to Miles&Smiles</h3>
                    <p className="text-white/80">
                      Earn {milesEarned.toLocaleString()} miles with this booking!
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/login')}
                  className="bg-white text-turkish-red px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                >
                  Sign In
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Passenger Information */}
            <div className="card mb-6">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <User className="text-turkish-red" />
                Passenger Information
              </h2>
              
              <p className="text-sm text-gray-500 mb-6 flex items-center gap-2">
                <AlertCircle size={16} />
                Names must match passport/ID exactly
              </p>

              {passengers.map((passenger, index) => (
                <div key={index} className="mb-8 pb-8 border-b border-gray-100 last:border-0 last:mb-0 last:pb-0">
                  <h3 className="font-semibold text-gray-700 mb-4">
                    Passenger {index + 1} {index === 0 && member && '(Primary)'}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Title</label>
                      <select
                        value={passenger.title}
                        onChange={(e) => handlePassengerChange(index, 'title', e.target.value)}
                        className="input-field"
                        required
                      >
                        <option value="Mr">Mr</option>
                        <option value="Ms">Ms</option>
                        <option value="Mrs">Mrs</option>
                        <option value="Miss">Miss</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">First Name *</label>
                      <input
                        type="text"
                        value={passenger.firstName}
                        onChange={(e) => handlePassengerChange(index, 'firstName', e.target.value)}
                        className="input-field"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Last Name *</label>
                      <input
                        type="text"
                        value={passenger.lastName}
                        onChange={(e) => handlePassengerChange(index, 'lastName', e.target.value)}
                        className="input-field"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Date of Birth *</label>
                      <input
                        type="date"
                        value={passenger.dateOfBirth}
                        onChange={(e) => handlePassengerChange(index, 'dateOfBirth', e.target.value)}
                        className="input-field"
                        required
                      />
                    </div>
                  </div>
                  
                  {index === 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
                        <input
                          type="email"
                          value={passenger.email}
                          onChange={(e) => handlePassengerChange(index, 'email', e.target.value)}
                          className="input-field"
                          placeholder="For booking confirmation"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Phone</label>
                        <input
                          type="tel"
                          value={passenger.phone}
                          onChange={(e) => handlePassengerChange(index, 'phone', e.target.value)}
                          className="input-field"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Join Miles&Smiles */}
              {!member && (
                <label className="flex items-center gap-3 mt-4 p-4 bg-gray-50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wantToJoin}
                    onChange={(e) => setWantToJoin(e.target.checked)}
                    className="w-5 h-5 text-turkish-red rounded focus:ring-turkish-red"
                  />
                  <div>
                    <span className="font-medium">I want to join Miles&Smiles</span>
                    <p className="text-sm text-gray-500">Start earning miles with this flight!</p>
                  </div>
                </label>
              )}
            </div>

            {/* Payment */}
            <div className="card mb-6">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <CreditCard className="text-turkish-red" />
                Payment
              </h2>

              {/* Miles Payment Option */}
              {(member || user) && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  {profileLoading ? (
                    <div className="flex items-center gap-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-turkish-red"></div>
                      <span className="text-sm text-gray-500">Loading miles information...</span>
                    </div>
                  ) : (
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useMiles}
                        onChange={(e) => handleMilesChange(e.target.checked)}
                        disabled={!member}
                        className="w-5 h-5 text-turkish-red rounded focus:ring-turkish-red cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <div className="flex-1">
                        <span className="font-medium">Pay with Miles</span>
                        {member ? (
                          <p className="text-sm text-gray-500">
                            {hasEnoughMiles
                              ? `Use ${milesNeeded.toLocaleString()} miles to pay full amount (You have ${availableMiles.toLocaleString()} miles)`
                              : hasMiles
                              ? `You have ${availableMiles.toLocaleString()} miles (can cover $${(availableMiles / 100).toFixed(2)} of $${totalPrice.toFixed(2)})`
                              : `You need ${milesNeeded.toLocaleString()} miles. You have ${availableMiles.toLocaleString()} miles`}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-500">Sign in to use your miles</p>
                        )}
                      </div>
                    </label>
                  )}
                </div>
              )}

              {/* Price Summary */}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    {passengerCount} x ${parseFloat(flight.base_price).toFixed(2)}
                  </span>
                  <span className="font-medium">${totalPrice.toFixed(2)}</span>
                </div>
                
                {useMiles && hasMiles && (
                  <>
                    <div className="flex justify-between text-green-600">
                      <span>Miles discount ({Math.min(availableMiles, milesNeeded).toLocaleString()} miles)</span>
                      <span>-${Math.min((availableMiles / 100), totalPrice).toFixed(2)}</span>
                    </div>
                  </>
                )}
                
                <div className="border-t pt-3 flex justify-between">
                  <span className="text-lg font-bold">Total</span>
                  <span className="text-2xl font-bold text-turkish-red">
                    {useMiles && hasMiles ? (
                      <>
                        {hasEnoughMiles ? (
                          <>
                            <span className="text-lg font-normal text-gray-500 line-through mr-2">
                              ${totalPrice.toFixed(2)}
                            </span>
                            $0.00
                          </>
                        ) : (
                          `$${(totalPrice - (availableMiles / 100)).toFixed(2)}`
                        )}
                      </>
                    ) : (
                      `$${totalPrice.toFixed(2)}`
                    )}
                  </span>
                </div>
                
                {member && !useMiles && (
                  <div className="flex justify-between text-turkish-red text-sm">
                    <span>Miles you'll earn</span>
                    <span>+{milesEarned.toLocaleString()} miles</span>
                  </div>
                )}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={buyMutation.isPending}
              className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2"
            >
              {buyMutation.isPending ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check size={20} />
                  Complete Booking
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Booking

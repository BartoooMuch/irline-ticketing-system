import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { searchFlights } from '../services/api'
import { Plane, Clock, ArrowRight, Filter, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

function FlightCard({ flight, passengers, onSelect }) {
  const occupancyPercent = ((flight.total_capacity - flight.available_capacity) / flight.total_capacity) * 100

  return (
    <div className="card hover:shadow-lg transition-shadow cursor-pointer group" onClick={onSelect}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Flight Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-turkish-red">{flight.flight_code}</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-500 text-sm">{flight.airline_name || 'Turkish Airlines'}</span>
            {flight.is_direct && (
              <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">Direct</span>
            )}
          </div>

          <div className="flex items-center gap-8">
            {/* Departure */}
            <div className="text-center">
              <p className="text-2xl font-bold">{flight.departure_time?.slice(0, 5)}</p>
              <p className="text-gray-600">{flight.from_airport_code}</p>
              <p className="text-xs text-gray-400">{flight.from_city}</p>
            </div>

            {/* Duration */}
            <div className="flex-1 flex flex-col items-center">
              <p className="text-sm text-gray-500 mb-1">
                {Math.floor(flight.duration_minutes / 60)}h {flight.duration_minutes % 60}m
              </p>
              <div className="w-full h-px bg-gray-300 relative">
                <Plane className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-turkish-red bg-white" size={16} />
              </div>
            </div>

            {/* Arrival */}
            <div className="text-center">
              <p className="text-2xl font-bold">{flight.arrival_time?.slice(0, 5)}</p>
              <p className="text-gray-600">{flight.to_airport_code}</p>
              <p className="text-xs text-gray-400">{flight.to_city}</p>
            </div>
          </div>
        </div>

        {/* Price & Action */}
        <div className="md:border-l md:pl-6 border-gray-100">
          <div className="text-right">
            <p className="text-sm text-gray-500">from</p>
            <p className="text-3xl font-bold text-turkish-red">
              ${parseFloat(flight.base_price).toFixed(0)}
            </p>
            <p className="text-xs text-gray-500">per person</p>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-end gap-2 text-sm">
              <div className="w-20 bg-gray-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${
                    occupancyPercent > 80 ? 'bg-red-500' : occupancyPercent > 50 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${occupancyPercent}%` }}
                />
              </div>
              <span className={`text-xs ${
                flight.available_capacity < passengers
                  ? 'text-red-500'
                  : flight.available_capacity < 10
                  ? 'text-orange-500'
                  : 'text-gray-500'
              }`}>
                {flight.available_capacity} seats left
              </span>
            </div>
          </div>

          <button className="mt-3 w-full btn-primary group-hover:bg-turkish-dark flex items-center justify-center gap-2">
            Select
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

function SearchResults() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const params = {
    from: searchParams.get('from'),
    to: searchParams.get('to'),
    date: searchParams.get('date'),
    passengers: searchParams.get('passengers') || '1',
    flexibleDates: searchParams.get('flexibleDates'),
    directOnly: searchParams.get('directOnly'),
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['flights', params],
    queryFn: () => searchFlights(params),
    enabled: !!params.from && !!params.to && !!params.date,
  })

  const flights = data?.data?.data?.flights || []
  const searchParams_info = data?.data?.data?.searchParams || {}

  const handleSelectFlight = (flight) => {
    navigate(`/booking/${flight.id}?passengers=${params.passengers}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-turkish-red text-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold">{params.from}</span>
              <ArrowRight size={24} />
              <span className="text-2xl font-bold">{params.to}</span>
            </div>
            <div className="text-white/80">
              • {format(new Date(params.date), 'EEE, MMM d, yyyy')}
              • {params.passengers} passenger{params.passengers > 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Filters */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-600">
            {isLoading ? 'Searching...' : `${flights.length} flights found`}
          </p>
          <button className="btn-secondary flex items-center gap-2">
            <Filter size={18} />
            Filters
          </button>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-gray-200 rounded-full"></div>
              <div className="w-16 h-16 border-4 border-turkish-red border-t-transparent rounded-full absolute top-0 animate-spin"></div>
            </div>
            <p className="mt-4 text-gray-500">Searching for the best flights...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
            <p className="text-red-600">Error loading flights. Please try again.</p>
          </div>
        ) : flights.length === 0 ? (
          <div className="text-center py-20">
            <Plane className="mx-auto text-gray-300 mb-4" size={64} />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No flights found</h3>
            <p className="text-gray-500 mb-6">
              Try different dates or enable flexible dates for more options.
            </p>
            <button onClick={() => navigate('/')} className="btn-primary">
              New Search
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {flights.map((flight) => (
              <FlightCard
                key={flight.id}
                flight={flight}
                passengers={parseInt(params.passengers)}
                onSelect={() => handleSelectFlight(flight)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default SearchResults

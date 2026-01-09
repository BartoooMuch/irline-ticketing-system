import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getFlights, updateFlight } from '../services/api'
import { Link } from 'react-router-dom'
import { 
  Plane, 
  Plus, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Edit,
  XCircle
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

function FlightList() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    status: '',
    date: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['flights', page, filters],
    queryFn: () => {
      const params = { page, limit: 20 }
      if (filters.status) params.status = filters.status
      if (filters.date) params.date = filters.date
      return getFlights(params)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateFlight(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['flights'])
      toast.success('Flight updated')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Update failed')
    },
  })

  const flights = data?.data?.data?.flights || []
  const pagination = data?.data?.data?.pagination || { page: 1, totalPages: 1, total: 0 }

  const handleCancel = (flightId) => {
    if (confirm('Are you sure you want to cancel this flight?')) {
      updateMutation.mutate({ id: flightId, data: { status: 'CANCELLED' } })
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Flights</h1>
          <p className="text-gray-500 mt-1">Manage all scheduled flights</p>
        </div>
        <Link to="/flights/add" className="btn-primary flex items-center gap-2 w-fit">
          <Plus size={20} />
          Add Flight
        </Link>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="input-field"
            >
              <option value="">All Statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="DELAYED">Delayed</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date
            </label>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters({ ...filters, date: e.target.value })}
              className="input-field"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ status: '', date: '' })}
              className="btn-secondary"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-turkish-red"></div>
          </div>
        ) : flights.length === 0 ? (
          <div className="text-center py-12">
            <Plane className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-500">No flights found</p>
            <Link to="/flights/add" className="text-turkish-red hover:underline mt-2 inline-block">
              Add your first flight
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Flight</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Route</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Time</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Price</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Capacity</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {flights.map((flight) => (
                    <tr key={flight.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <span className="font-semibold text-gray-800">{flight.flight_code}</span>
                        <p className="text-xs text-gray-500">{flight.airline_name}</p>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{flight.from_airport_code}</span>
                          <span className="text-gray-400">→</span>
                          <span className="font-medium">{flight.to_airport_code}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-gray-600">
                        {format(new Date(flight.departure_date), 'MMM dd, yyyy')}
                      </td>
                      <td className="py-4 px-4 text-gray-600">
                        {flight.departure_time?.slice(0, 5)} - {flight.arrival_time?.slice(0, 5)}
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-semibold text-gray-800">
                          ${parseFloat(flight.base_price).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-turkish-red h-2 rounded-full"
                              style={{
                                width: `${((flight.total_capacity - flight.available_capacity) / flight.total_capacity) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm text-gray-600">
                            {flight.total_capacity - flight.available_capacity}/{flight.total_capacity}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            flight.status === 'SCHEDULED'
                              ? 'bg-green-100 text-green-700'
                              : flight.status === 'CANCELLED'
                              ? 'bg-red-100 text-red-700'
                              : flight.status === 'COMPLETED'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {flight.status}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          {flight.status === 'SCHEDULED' && (
                            <button
                              onClick={() => handleCancel(flight.id)}
                              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                              title="Cancel flight"
                            >
                              <XCircle size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, pagination.total)} of{' '}
                {pagination.total} flights
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="px-4 py-2 text-sm">
                  Page {page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default FlightList

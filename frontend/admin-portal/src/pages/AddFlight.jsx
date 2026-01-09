import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFlight, getAirports, predictPrice } from '../services/api'
import { Plane, Calendar, Clock, Users, DollarSign, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { format, addDays } from 'date-fns'

function AddFlight() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    flightCode: '',
    fromAirportCode: '',
    toAirportCode: '',
    departureDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    departureTime: '08:00',
    arrivalTime: '10:00',
    durationMinutes: 120,
    price: '',
    capacity: 180,
    isDirect: true,
  })

  const [predictedPrice, setPredictedPrice] = useState(null)
  const [isPredicting, setIsPredicting] = useState(false)

  // Fetch airports
  const { data: airportsData } = useQuery({
    queryKey: ['airports'],
    queryFn: () => getAirports(),
  })
  const airports = airportsData?.data?.data?.airports || []

  // Create flight mutation
  const createMutation = useMutation({
    mutationFn: createFlight,
    onSuccess: () => {
      toast.success('Flight created successfully!')
      navigate('/flights')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create flight')
    },
  })

  // Calculate duration when times change
  useEffect(() => {
    if (formData.departureTime && formData.arrivalTime) {
      const [depHour, depMin] = formData.departureTime.split(':').map(Number)
      const [arrHour, arrMin] = formData.arrivalTime.split(':').map(Number)
      
      let duration = (arrHour * 60 + arrMin) - (depHour * 60 + depMin)
      if (duration < 0) duration += 24 * 60 // Handle overnight flights
      
      setFormData((prev) => ({ ...prev, durationMinutes: duration }))
    }
  }, [formData.departureTime, formData.arrivalTime])

  // Predict price using ML
  const handlePredictPrice = async () => {
    if (!formData.fromAirportCode || !formData.toAirportCode) {
      toast.error('Please select airports first')
      return
    }

    setIsPredicting(true)
    try {
      const response = await predictPrice({
        fromAirport: formData.fromAirportCode,
        toAirport: formData.toAirportCode,
        departureDate: formData.departureDate,
        durationMinutes: formData.durationMinutes,
      })
      
      const predicted = response.data.predictedPrice
      setPredictedPrice(predicted)
      setFormData((prev) => ({ ...prev, price: predicted.toFixed(2) }))
      toast.success(`Price predicted: $${predicted.toFixed(2)}`)
    } catch (error) {
      toast.error('Price prediction failed')
    } finally {
      setIsPredicting(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    // Validate
    if (formData.fromAirportCode === formData.toAirportCode) {
      toast.error('Departure and arrival airports must be different')
      return
    }

    createMutation.mutate({
      ...formData,
      price: formData.price ? parseFloat(formData.price) : undefined,
    })
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Add New Flight</h1>
        <p className="text-gray-500 mt-1">Create a new flight with schedule and pricing</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-4xl">
        <div className="card mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Plane className="text-turkish-red" />
            Flight Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Flight Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Flight Code
              </label>
              <input
                type="text"
                name="flightCode"
                value={formData.flightCode}
                onChange={handleChange}
                className="input-field"
                placeholder="e.g., TK123"
                required
                maxLength={10}
              />
            </div>

            {/* Capacity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Users className="inline mr-1" size={16} />
                Capacity
              </label>
              <input
                type="number"
                name="capacity"
                value={formData.capacity}
                onChange={handleChange}
                className="input-field"
                min={1}
                max={500}
                required
              />
            </div>

            {/* From Airport */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From City
              </label>
              <select
                name="fromAirportCode"
                value={formData.fromAirportCode}
                onChange={handleChange}
                className="input-field"
                required
              >
                <option value="">Select departure airport</option>
                {airports.map((airport) => (
                  <option key={airport.id} value={airport.code}>
                    {airport.city} ({airport.code}) - {airport.name}
                  </option>
                ))}
              </select>
            </div>

            {/* To Airport */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To City
              </label>
              <select
                name="toAirportCode"
                value={formData.toAirportCode}
                onChange={handleChange}
                className="input-field"
                required
              >
                <option value="">Select arrival airport</option>
                {airports.map((airport) => (
                  <option key={airport.id} value={airport.code}>
                    {airport.city} ({airport.code}) - {airport.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="card mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Calendar className="text-turkish-red" />
            Schedule
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Flight Date
              </label>
              <input
                type="date"
                name="departureDate"
                value={formData.departureDate}
                onChange={handleChange}
                className="input-field"
                min={format(new Date(), 'yyyy-MM-dd')}
                required
              />
            </div>

            {/* Departure Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="inline mr-1" size={16} />
                Departure Time
              </label>
              <input
                type="time"
                name="departureTime"
                value={formData.departureTime}
                onChange={handleChange}
                className="input-field"
                required
              />
            </div>

            {/* Arrival Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="inline mr-1" size={16} />
                Arrival Time
              </label>
              <input
                type="time"
                name="arrivalTime"
                value={formData.arrivalTime}
                onChange={handleChange}
                className="input-field"
                required
              />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration (mins)
              </label>
              <input
                type="number"
                name="durationMinutes"
                value={formData.durationMinutes}
                onChange={handleChange}
                className="input-field bg-gray-50"
                min={1}
                required
              />
            </div>
          </div>

          {/* Direct Flight */}
          <div className="mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="isDirect"
                checked={formData.isDirect}
                onChange={handleChange}
                className="w-4 h-4 text-turkish-red rounded focus:ring-turkish-red"
              />
              <span className="text-gray-700">Direct Flight</span>
            </label>
          </div>
        </div>

        {/* Pricing */}
        <div className="card mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <DollarSign className="text-turkish-red" />
            Pricing
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Base Price (USD)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    className="input-field pl-8"
                    placeholder="Leave empty to use ML prediction"
                    min={0}
                    step={0.01}
                  />
                </div>
                <button
                  type="button"
                  onClick={handlePredictPrice}
                  disabled={isPredicting}
                  className="btn-secondary flex items-center gap-2 whitespace-nowrap"
                >
                  {isPredicting ? (
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-turkish-red rounded-full animate-spin" />
                  ) : (
                    <Sparkles size={18} />
                  )}
                  Predict
                </button>
              </div>
              {predictedPrice && (
                <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                  <Sparkles size={14} />
                  ML Predicted: ${predictedPrice.toFixed(2)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            {createMutation.isPending ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Plane size={18} />
            )}
            Create Flight
          </button>
          <button
            type="button"
            onClick={() => navigate('/flights')}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default AddFlight

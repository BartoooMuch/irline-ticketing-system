const { v4: uuidv4 } = require('uuid');
const emailService = require('./emailService');
const logger = require('../utils/logger');

/**
 * Process completed flights and update member miles
 * Runs nightly at 2:00 AM
 */
const processCompletedFlights = async (pool) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get all tickets from flights that completed yesterday
    const completedFlightsQuery = `
      SELECT 
        t.id as ticket_id,
        t.member_id,
        t.price_paid,
        t.miles_earned,
        m.email,
        m.first_name,
        m.member_number,
        f.flight_code,
        fa.code as from_airport,
        ta.code as to_airport
      FROM tickets t
      JOIN flights f ON t.flight_id = f.id
      JOIN airports fa ON f.from_airport_id = fa.id
      JOIN airports ta ON f.to_airport_id = ta.id
      LEFT JOIN miles_smiles_members m ON t.member_id = m.id
      WHERE f.departure_date = CURRENT_DATE - INTERVAL '1 day'
        AND f.status = 'SCHEDULED'
        AND t.status = 'CONFIRMED'
        AND t.member_id IS NOT NULL
        AND t.miles_earned > 0
    `;
    
    const tickets = await client.query(completedFlightsQuery);
    
    logger.info(`Processing ${tickets.rows.length} tickets for miles update`);
    
    for (const ticket of tickets.rows) {
      // Check if miles already credited
      const existingTx = await client.query(
        `SELECT id FROM miles_transactions 
         WHERE ticket_id = $1 AND transaction_type = 'CREDIT' AND source = 'FLIGHT'`,
        [ticket.ticket_id]
      );
      
      if (existingTx.rows.length > 0) {
        continue; // Already processed
      }
      
      // Credit miles to member
      await client.query(
        `UPDATE miles_smiles_members 
         SET total_miles = total_miles + $1, 
             available_miles = available_miles + $1 
         WHERE id = $2`,
        [ticket.miles_earned, ticket.member_id]
      );
      
      // Record transaction
      await client.query(
        `INSERT INTO miles_transactions (
          id, member_id, ticket_id, transaction_type, miles_amount, 
          description, source, processed, notification_sent
        ) VALUES ($1, $2, $3, 'CREDIT', $4, $5, 'FLIGHT', TRUE, FALSE)`,
        [
          uuidv4(),
          ticket.member_id,
          ticket.ticket_id,
          ticket.miles_earned,
          `Flight ${ticket.flight_code}: ${ticket.from_airport} → ${ticket.to_airport}`,
        ]
      );
      
      logger.info(`Credited ${ticket.miles_earned} miles to ${ticket.member_number}`);
    }
    
    // Update flight status to completed
    await client.query(`
      UPDATE flights 
      SET status = 'COMPLETED' 
      WHERE departure_date = CURRENT_DATE - INTERVAL '1 day'
        AND status = 'SCHEDULED'
    `);
    
    await client.query('COMMIT');
    logger.info('Completed flights processing finished');
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error processing completed flights:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Process pending welcome emails (fallback for queue failures)
 * Runs hourly
 */
const processPendingWelcomeEmails = async (pool) => {
  try {
    // Get members who haven't received welcome email
    const result = await pool.query(`
      SELECT m.id, m.email, m.first_name, m.last_name, m.member_number
      FROM miles_smiles_members m
      JOIN new_member_queue q ON m.id = q.member_id
      WHERE m.welcome_email_sent = FALSE
        AND q.processed = FALSE
        AND q.created_at < NOW() - INTERVAL '1 hour'
      LIMIT 50
    `);
    
    logger.info(`Found ${result.rows.length} pending welcome emails`);
    
    for (const member of result.rows) {
      try {
        await emailService.sendWelcomeEmail({
          email: member.email,
          firstName: member.first_name,
          lastName: member.last_name,
          memberNumber: member.member_number,
        });
        
        // Update status
        await pool.query(
          'UPDATE miles_smiles_members SET welcome_email_sent = TRUE WHERE id = $1',
          [member.id]
        );
        await pool.query(
          `UPDATE new_member_queue SET processed = TRUE, processed_at = NOW() 
           WHERE member_id = $1`,
          [member.id]
        );
        
        logger.info(`Sent welcome email to ${member.email}`);
      } catch (error) {
        logger.error(`Failed to send welcome email to ${member.email}:`, error);
      }
    }
    
  } catch (error) {
    logger.error('Error processing pending welcome emails:', error);
  }
};

/**
 * Send notifications for members with recent miles transactions
 * Runs every 6 hours
 */
const sendMilesNotifications = async (pool) => {
  try {
    // Get unnotified transactions grouped by member
    const result = await pool.query(`
      SELECT 
        m.id as member_id,
        m.email,
        m.first_name,
        m.member_number,
        m.available_miles,
        SUM(mt.miles_amount) as total_miles,
        ARRAY_AGG(mt.id) as transaction_ids
      FROM miles_transactions mt
      JOIN miles_smiles_members m ON mt.member_id = m.id
      WHERE mt.notification_sent = FALSE
        AND mt.transaction_type = 'CREDIT'
        AND mt.created_at > NOW() - INTERVAL '24 hours'
      GROUP BY m.id, m.email, m.first_name, m.member_number, m.available_miles
      LIMIT 100
    `);
    
    logger.info(`Found ${result.rows.length} members to notify about miles`);
    
    for (const member of result.rows) {
      try {
        await emailService.sendMilesUpdateEmail({
          email: member.email,
          firstName: member.first_name,
          miles: parseInt(member.total_miles),
          source: 'Turkish Airlines',
          newBalance: member.available_miles,
        });
        
        // Mark transactions as notified
        await pool.query(
          'UPDATE miles_transactions SET notification_sent = TRUE WHERE id = ANY($1)',
          [member.transaction_ids]
        );
        
        logger.info(`Sent miles notification to ${member.email}`);
      } catch (error) {
        logger.error(`Failed to send miles notification to ${member.email}:`, error);
      }
    }
    
  } catch (error) {
    logger.error('Error sending miles notifications:', error);
  }
};

module.exports = {
  processCompletedFlights,
  processPendingWelcomeEmails,
  sendMilesNotifications,
};

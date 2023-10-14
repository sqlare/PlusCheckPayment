//코체 멍청이
const mysql = require('mysql2/promise');
const axios = require('axios');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('config.json'));
const pool = mysql.createPool(config.mysql);

const checkAndRecordTransfers = async () => {
  try {
    const requestOptions = {
        url: `https://api-public.toss.im/api-public/v3/cashtag/transfer-feed/received/list?inputWord=${config.toss.inputWord}`, // 대상 서버 URL
        method: 'GET'
    };

    const tossResponse = await axios(requestOptions);
    const transfers = tossResponse.data.success.data;
    for (const transfer of transfers) {
        const tossDateTime = new Date(transfer.transferedTs);
        const mysqlDateTime = tossDateTime.toISOString().slice(0, 19).replace('T', ' ');
      
        const [existingTransfer] = await pool.query('SELECT * FROM cash_transfers WHERE cashtagTransferId = ?', [transfer.cashtagTransferId]);
      
        if (existingTransfer.length === 0) {
          await pool.query('INSERT INTO cash_transfers (method, cashtagTransferId, senderDisplayName, amount, transferedTs) VALUES (?, ?, ?, ?, ?)',
            ['unknown', transfer.cashtagTransferId, transfer.senderDisplayName, transfer.amount, mysqlDateTime]);
        } else {
          if (existingTransfer[0].amount !== transfer.amount || existingTransfer[0].senderDisplayName !== transfer.senderDisplayName) {
            await pool.query('UPDATE cash_transfers SET amount = ?, senderDisplayName = ?, transferedTs = ? WHERE cashtagTransferId = ?',
              [transfer.amount, transfer.senderDisplayName, mysqlDateTime, transfer.cashtagTransferId]);
          }
        }
      }
      
  } catch (error) {
    console.error('Error:', error);
  }
};

// 레이트리밋 우회를 위한 비주기적 리퀘스트
setInterval(checkAndRecordTransfers, (Math.floor(Math.random() * 5) + 1) * 60 * 1000);
checkAndRecordTransfers();

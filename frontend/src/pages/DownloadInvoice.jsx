// src/components/DownloadInvoice.jsx

import React from "react";
import axios from "axios";

const DownloadInvoice = ({ session }) => {

  const downloadInvoice = async () => {
    try {
      const response = await axios.post(
        "http://localhost:5000/api/invoice/generate",
        session, // send charging data
        {
          responseType: "blob",     // VERY IMPORTANT
          headers: {
            "Content-Type": "application/json"
          }
        }
      );

      // Create a URL for the PDF blob
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;

      // Filename
      link.setAttribute("download", `invoice_${session.transactionId}.pdf`);
      document.body.appendChild(link);

      link.click(); // Auto download
      link.remove();

      console.log("Invoice downloaded successfully");

    } catch (error) {
      console.error("Invoice download failed:", error);
      alert("Cannot download invoice right now.");
    }
  };

  return (
    <button 
      onClick={downloadInvoice}
      style={{
        padding: "10px 20px",
        background: "#007bff",
        color: "white",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
        marginTop: "10px"
      }}
    >
      Download Invoice (PDF)
    </button>
  );
};

export default DownloadInvoice;

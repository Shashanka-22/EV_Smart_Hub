// 📄 frontend/src/admin/AdminPerformance.jsx

import React, { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import { getStationPerformance } from "../api/api";
import { Line } from "react-chartjs-2";

// ✅ FIX: Register Chart.js Scales
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

export default function AdminPerformance() {
  const [data, setData] = useState([]);

  useEffect(() => {
    loadPerformance();
  }, []);

  const loadPerformance = async () => {
    const res = await getStationPerformance();
    if (!res.error) setData(res);
  };

  return (
    <AdminLayout>
      <h1>📈 Station Performance</h1>

      {data.length > 0 ? (
        <div style={{ marginTop: 30 }}>
          <Line
            data={{
              labels: data.map((d) => d.station_name),
              datasets: [
                {
                  label: "Revenue (₹)",
                  data: data.map((d) => d.revenue),
                  borderColor: "blue",
                  backgroundColor: "rgba(0, 0, 255, 0.3)",
                },
              ],
            }}
          />
        </div>
      ) : (
        <p style={{ marginTop: 20 }}>Loading performance data...</p>
      )}
    </AdminLayout>
  );
}

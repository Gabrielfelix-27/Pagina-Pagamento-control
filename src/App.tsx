import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import PlansPage from './pages/PlansPage';
import CheckoutSuccess from './pages/CheckoutSuccess';
import CheckoutCancel from './pages/CheckoutCancel';
import Success from './pages/Success';
import AdminUsers from './pages/AdminUsers';
import CredentialsSuccessPage from './pages/CredentialsSuccessPage';
import PaymentConfirmation from './pages/PaymentConfirmation';
import Footer from './components/Footer';

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-gray-900 text-white">
        <Header />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/success" element={<Success />} />
            <Route path="/checkout-success" element={<CheckoutSuccess />} />
            <Route path="/payment-success" element={<CredentialsSuccessPage />} />
            <Route path="/payment-confirmation" element={<PaymentConfirmation />} />
            <Route path="/cancel" element={<CheckoutCancel />} />
            <Route path="/admin/users" element={<AdminUsers />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
// src/App.jsx
import { useState } from 'react';
import styled from 'styled-components';
import FormChecker from './components/FormChecker';
import './App.css';

const AppContainer = styled.div`
  min-height: 100vh;
  background-color: #f8f9fa;
`;

const Header = styled.header`
  background-color: #343a40;
  color: white;
  padding: 1rem 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const Nav = styled.nav`
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
`;

const Logo = styled.div`
  font-size: 1.5rem;
  font-weight: bold;
`;

const NavLinks = styled.div`
  display: flex;
  gap: 20px;
`;

const NavLink = styled.a`
  color: white;
  text-decoration: none;
  padding: 5px 10px;
  border-radius: 4px;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  &.active {
    background-color: #007bff;
  }
`;

const Main = styled.main`
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
`;

function App() {
  return (
    <AppContainer>
      <Header>
        <Nav>
          <Logo>BasketballForm.AI</Logo>
          <NavLinks>
            <NavLink href="#">Home</NavLink>
            <NavLink href="#" className="active">Form Checker</NavLink>
            <NavLink href="#">Tips</NavLink>
            <NavLink href="#">About</NavLink>
          </NavLinks>
        </Nav>
      </Header>
      
      <Main>
        <FormChecker />
      </Main>
    </AppContainer>
  );
}

export default App;
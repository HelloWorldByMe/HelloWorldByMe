import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import NavForm from '../frontend/src/NavForm';

// Mock fetch API
global.fetch = jest.fn();

// Helper function to mock successful fetch response
const mockFetchSuccess = (data) => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => data,
  });
};

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  user_id: '123'
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('NavigatorForm Component', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch.mockReset();
    // Mock the initial API call to get clients
    mockFetchSuccess({
      clients: [
        {
          id: '1',
          first_name: 'John',
          last_name: 'Doe',
          age: 30,
          gender: 'Male',
          veteran_stat: 'not a veteran',
          num_children: 2,
          current_situation: 'Temporary housing',
          services: ['food', 'housing'],
          clientNotes: []
        }
      ]
    });
    // Mock window.alert
    window.alert = jest.fn();
  });

  test('renders the NavigatorForm component', async () => {
    render(<NavForm />);
    
    // Check if the main heading is present
    expect(screen.getByText('Navigator Form')).toBeInTheDocument();
    
    // Check if search section is present
    expect(screen.getByText('Search for an Individual')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter Name')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    
    // Check if filters are present
    expect(screen.getByText('All Veteran Statuses')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Number of Kids')).toBeInTheDocument();

    // Verify fetch was called for initial data loading
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/clients');
    });
  });

  test('performs search and displays results', async () => {
    render(<NavForm />);
    
    // Set search term
    const searchInput = screen.getByPlaceholderText('Enter Name');
    fireEvent.change(searchInput, { target: { value: 'John Doe' } });
    
    // Click search button
    const searchButton = screen.getByText('Search');
    fireEvent.click(searchButton);
    
    // // Wait for the results to be displayed
    await waitFor(() => {
      const john = screen.getAllByDisplayValue('John Doe');
      expect(john[0]).toBeInTheDocument();
    });
    

  });

  test('shows form when no search results found', async () => {
    render(<NavForm />);
    
    // Enter name that won't match any results
    const searchInput = screen.getByPlaceholderText('Enter Name');
    fireEvent.change(searchInput, { target: { value: 'Jane Smith' } });
    
    // Click search button
    const searchButton = screen.getByText('Search');
    fireEvent.click(searchButton);

    // Wait for form to be displayed
    await waitFor(() => {
      const expectedInfo = screen.getAllByText('Enter Information');
      expect(expectedInfo.length).toBeGreaterThan(0);
      expect(expectedInfo[0]).toBeInTheDocument();
    });
  });
});
import { render, screen } from '@testing-library/react';
import Mapping from '../frontend/src/Mapping'; // Adjust based on file path
import '@testing-library/jest-dom';

// mock images
jest.mock('leaflet/dist/images/marker-icon-2x.png', () => 'marker-icon-2x.png');
jest.mock('leaflet/dist/images/marker-icon.png', () => 'marker-icon.png');
jest.mock('leaflet/dist/images/marker-shadow.png', () => 'marker-shadow.png');

// mock css  imports 
jest.mock('leaflet/dist/leaflet.css', () => {});

// mock react-leaflet components and hooks
jest.mock('react-leaflet', () => ({
  MapContainer: jest.fn().mockImplementation(({ children }) => <div data-testid="map">{children}</div>),
  TileLayer: jest.fn().mockImplementation(() => <div data-testid="tile-layer" />),
  Marker: jest.fn().mockImplementation(() => <div data-testid="marker" />),
  Popup: jest.fn().mockImplementation(() => <div data-testid="popup" />),
  Polyline: jest.fn().mockImplementation(() => <div data-testid="polyline" />),
  useMap: jest.fn(),
  useMapEvents: jest.fn(),
}));

// mock fetch response for clients data
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () =>
      Promise.resolve({
        clients: [
          { id: '1', first_name: 'John', last_name: 'Doe' },
          { id: '2', first_name: 'Jane', last_name: 'Smith' },
        ],
      }),
  })
);

describe('Mapping Component', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  test('renders mapping interface', async () => {
    render(<Mapping />);
    expect(await screen.findByText(/WorldByMe Mapping Interface/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Select Client to Place Marker/i)).toBeInTheDocument();
    expect(screen.getByText(/Place Marker on Map/i)).toBeInTheDocument();
    expect(screen.getByTestId('map')).toBeInTheDocument();
  });

  test('fetches client in dropdown', async () => {
    render(<Mapping/>);

    expect(await screen.findByText(/John Doe/i)).toBeInTheDocument();
  });

});

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ServiceMatch from '../frontend/src/ServiceMatch';
import '@testing-library/jest-dom';


jest.spyOn(window, 'alert').mockImplementation(() => {});


test("ServiceMatch component", async () => {
    render(<ServiceMatch/>);

    expect(screen.getByLabelText(/Select Individual/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Age/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Gender/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mental Health\/SUD\/General Needs:/i)).toBeInTheDocument();
    expect(screen.getByText(/Find Services/i)).toBeInTheDocument();
});

test("Find Services button without form input", async () => {
    render(<ServiceMatch />);
    const button = screen.getByText(/Find Services/i);
    fireEvent.click(button);

    expect(window.alert).toHaveBeenCalledWith("Please select a client");
});

test("displays 'No shelters available' when no shelters are found", async () => {
    render(<ServiceMatch />);

    // mock the fetch response to return no shelters
    global.fetch = jest.fn().mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce([]),  // Empty array simulating no shelters
    });

    const button = screen.getByText(/Find Services/i);
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByText(/No shelters available/i)).toBeInTheDocument());
});

test("form fields have default values", () => {
    render(<ServiceMatch />);
    
    expect(screen.getByLabelText(/Select Individual/i).value).toBe('');
    expect(screen.getByLabelText(/Age/i).value).toBe('12-17');
    expect(screen.getByLabelText(/Gender/i).value).toBe('Male');
    expect(screen.getByLabelText(/Mental Health\/SUD\/General Needs:/i).value).toBe('any');
});

test("alert is triggered when an invalid age range is selected", async () => {
    render(<ServiceMatch />);

    const button = screen.getByText(/Find Services/i);
    const ageField = screen.getByLabelText(/Age/i);

    fireEvent.change(ageField, { target: { value: 'Invalid Range' } });

    fireEvent.click(button);

    expect(window.alert).toHaveBeenCalledWith("Please select a client");
});

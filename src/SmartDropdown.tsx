import React, {
    FC,
    useEffect,
    useRef,
    useState,
    useMemo,
    CSSProperties,
} from "react";

interface SmartDropdownProps {
    label: string;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    storageKey: string;
    placeholder?: string;
    required?: boolean;
    /**
     * baseOptions
     *
     * Optional list of options coming from the app (e.g. suppliers, transporters).
     * These are merged with the history options from localStorage.
     */
    baseOptions?: string[];
}

/**
 * Normalize a list of strings:
 * - trim
 * - drop empty
 * - make unique
 * - sort alphabetically
 */
const normalizeList = (rawList: string[]): string[] => {
    const cleaned = rawList
        .map((v) => (v ?? "").trim())
        .filter((v) => v.length > 0);

    const unique = Array.from(new Set(cleaned));
    unique.sort((a, b) => a.localeCompare(b));
    return unique;
};

/**
 * Read options from localStorage for a given storageKey.
 * Safe (catches JSON / storage errors) and returns [] on failure.
 */
const loadOptionsFromStorage = (storageKey: string): string[] => {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return [];
        const arr = JSON.parse(raw) as string[];
        return normalizeList(arr);
    } catch {
        return [];
    }
};

/**
 * SmartDropdown
 *
 * - Text input with history-backed dropdown (localStorage)
 * - Can also take baseOptions from props (e.g. DB-driven values)
 * - Combined options are ALWAYS sorted alphabetically
 * - Dropdown filters as you type
 * - Options can be removed from the stored history with an X button
 */
const SmartDropdown: FC<SmartDropdownProps> = ({
    label,
    name,
    value,
    onChange,
    storageKey,
    placeholder,
    required,
    baseOptions = [],
}) => {
    const [inputValue, setInputValue] = useState<string>(value ?? "");
    // Only the options that are persisted in localStorage
    const [storedOptions, setStoredOptions] = useState<string[]>([]);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const saveOptionsToStorage = (list: string[]) => {
        const normalized = normalizeList(list);
        setStoredOptions(normalized);
        try {
            localStorage.setItem(storageKey, JSON.stringify(normalized));
        } catch {
            // ignore storage errors
        }
    };

    // ---- effects -----------------------------------------------------------

    // Load once on mount + when storageKey changes
    useEffect(() => {
        const loaded = loadOptionsFromStorage(storageKey);
        setStoredOptions(loaded);
    }, [storageKey]);

    // Sync internal input with parent value
    useEffect(() => {
        setInputValue(value ?? "");
    }, [value]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- derived state -------------------------------------------------------

    // Combine baseOptions (from props) + storedOptions (from history)
    const allOptions = useMemo(
        () => normalizeList([...(baseOptions || []), ...storedOptions]),
        [baseOptions, storedOptions]
    );

    const filteredOptions = useMemo(() => {
        const term = inputValue.trim().toLowerCase();
        if (!term) return allOptions;
        return allOptions.filter((opt) =>
            opt.toLowerCase().includes(term)
        );
    }, [allOptions, inputValue]);

    // --- handlers ------------------------------------------------------------

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        setIsOpen(true);
        onChange(e); // still behaves like a normal input for parent form
    };

    const handleBlur = () => {
        const v = inputValue.trim();
        if (!v) return;
        // Only add to stored history if it's not already there
        if (!storedOptions.includes(v)) {
            saveOptionsToStorage([...storedOptions, v]);
        }
    };

    const handleFocus = () => {
        setIsOpen(true);
    };

    const handleOptionClick = (opt: string) => {
        const syntheticEvent = {
            target: { name, value: opt },
        } as React.ChangeEvent<HTMLInputElement>;

        setInputValue(opt);
        onChange(syntheticEvent);

        // Persist to history if it's not already there
        if (!storedOptions.includes(opt)) {
            saveOptionsToStorage([...storedOptions, opt]);
        }
        setIsOpen(false);
    };

    const handleDeleteOption = (
        opt: string,
        e: React.MouseEvent<HTMLButtonElement>
    ) => {
        e.stopPropagation();
        const next = storedOptions.filter((o) => o !== opt);
        saveOptionsToStorage(next);
    };

    // --- inline styles -------------------------------------------------------

    const wrapperStyle: CSSProperties = {
        position: "relative",
    };

    const inputStyle: CSSProperties = {
        width: "100%",
        padding: "0.35rem 0.45rem",
        borderRadius: 4,
        border: "1px solid #aaa",
        boxSizing: "border-box",
    };

    const labelStyle: CSSProperties = {
        fontWeight: 600,
        display: "block",
        marginBottom: 4,
    };

    const dropdownStyle: CSSProperties = {
        position: "absolute",
        left: 0,
        right: 0,
        top: "100%",
        marginTop: 2,
        maxHeight: 200,
        overflowY: "auto",
        backgroundColor: "#ffffff",
        border: "1px solid #ccc",
        borderRadius: 4,
        zIndex: 999,
        boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
        fontSize: 13,
    };

    const optionStyle: CSSProperties = {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "4px 8px",
        cursor: "pointer",
    };

    const deleteButtonStyle: CSSProperties = {
        marginLeft: 8,
        border: "none",
        background: "transparent",
        color: "#b00000",
        cursor: "pointer",
        fontSize: 12,
    };

    // --- render --------------------------------------------------------------

    return (
        <div ref={containerRef}>
            <label style={labelStyle}>
                {label}
                {required ? " *" : ""}
            </label>
            <div style={wrapperStyle}>
                <input
                    type="text"
                    name={name}
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    onFocus={handleFocus}
                    placeholder={placeholder}
                    required={required}
                    autoComplete="off"
                    style={inputStyle}
                />
                {isOpen && filteredOptions.length > 0 && (
                    <div style={dropdownStyle}>
                        {filteredOptions.map((opt) => (
                            <div
                                key={opt}
                                style={optionStyle}
                                onClick={() => handleOptionClick(opt)}
                            >
                                <span>{opt}</span>
                                {/* Only allow deleting from history, not from baseOptions */}
                                {storedOptions.includes(opt) && (
                                    <button
                                        type="button"
                                        style={deleteButtonStyle}
                                        onClick={(e) =>
                                            handleDeleteOption(opt, e)
                                        }
                                        title="Remove from list"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SmartDropdown;

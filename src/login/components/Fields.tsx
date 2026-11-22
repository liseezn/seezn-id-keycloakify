import { useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import OutlinedInput from "@mui/material/OutlinedInput";
import { Eye, EyeOff } from "lucide-react";

type BaseFieldProps = {
    id: string;
    name: string;
    label: string;
    error?: string;
    autoFocus?: boolean;
    autoComplete?: string;
    defaultValue?: string;
    placeholder?: string;
};

type FieldShellProps = BaseFieldProps & {
    type: string;
    endAdornment?: React.ReactNode;
};

function FieldShell(props: FieldShellProps) {
    const { id, name, label, error, autoFocus, autoComplete, defaultValue, placeholder, type, endAdornment } = props;

    return (
        <Box component="div" className="sz-field" sx={{ mb: 2 }}>
            <Box
                component="label"
                htmlFor={id}
                sx={{
                    display: "block",
                    mb: 0.75,
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "text.primary"
                }}
            >
                {label}
            </Box>
            <OutlinedInput
                id={id}
                name={name}
                type={type}
                defaultValue={defaultValue}
                placeholder={placeholder}
                autoFocus={autoFocus}
                error={Boolean(error)}
                fullWidth
                endAdornment={endAdornment}
                inputProps={{
                    "aria-label": label,
                    "aria-invalid": Boolean(error),
                    "aria-describedby": error ? `${id}-error` : undefined,
                    autoComplete: autoComplete ?? "off"
                }}
                sx={{ fontSize: "1rem" }}
            />
            {error ? (
                <Box
                    component="p"
                    id={`${id}-error`}
                    role="alert"
                    sx={{ mt: 0.75, mb: 0, fontSize: "0.8125rem", color: "error.main" }}
                >
                    {error}
                </Box>
            ) : null}
        </Box>
    );
}

export function TextField(props: BaseFieldProps) {
    return <FieldShell {...props} type="text" />;
}

export function PasswordField(props: BaseFieldProps & { toggleLabels: { show: string; hide: string } }) {
    const { toggleLabels, ...rest } = props;
    const [revealed, setRevealed] = useState(false);

    return (
        <FieldShell
            {...rest}
            type={revealed ? "text" : "password"}
            endAdornment={
                <InputAdornment position="end">
                    <IconButton
                        aria-label={revealed ? toggleLabels.hide : toggleLabels.show}
                        aria-controls={rest.id}
                        aria-pressed={revealed}
                        onClick={() => setRevealed(value => !value)}
                        edge="end"
                        size="small"
                        sx={{ color: "text.secondary" }}
                    >
                        {revealed ? <EyeOff size={18} /> : <Eye size={18} />}
                    </IconButton>
                </InputAdornment>
            }
        />
    );
}

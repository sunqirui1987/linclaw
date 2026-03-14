package models

import "fmt"

type ServiceStatus struct {
	Label        string `json:"label"`
	PID          *int   `json:"pid"`
	Running      bool   `json:"running"`
	Description  string `json:"description"`
	CLIInstalled bool   `json:"cli_installed"`
}

type VersionInfo struct {
	Current         *string `json:"current"`
	Latest          *string `json:"latest"`
	UpdateAvailable bool    `json:"update_available"`
	Source          string  `json:"source"`
}

type CommandSpec struct {
	Name        string `json:"name"`
	Module      string `json:"module"`
	Implemented bool   `json:"implemented"`
	Description string `json:"description,omitempty"`
	Source      string `json:"source,omitempty"`
}

type APIError struct {
	Status  int    `json:"-"`
	Code    string `json:"code,omitempty"`
	Message string `json:"error"`
}

func (e *APIError) Error() string {
	if e == nil {
		return ""
	}
	return e.Message
}

func NewAPIError(status int, code, message string) *APIError {
	return &APIError{Status: status, Code: code, Message: message}
}

func WrapAPIError(status int, code string, err error) *APIError {
	if err == nil {
		return nil
	}
	return NewAPIError(status, code, err.Error())
}

func FormatNotImplemented(name, module string) string {
	return fmt.Sprintf("%s 尚未完成 Go 云端版迁移（模块: %s）", name, module)
}

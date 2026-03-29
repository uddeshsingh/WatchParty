package corsutil

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAllowedOrigins_EmptyUsesDefault(t *testing.T) {
	t.Setenv("ALLOWED_ORIGINS", "")
	t.Setenv("K_SERVICE", "")
	allowAny, origins := AllowedOrigins()
	assert.False(t, allowAny)
	assert.Equal(t, []string{"http://localhost:5173"}, origins)
}

func TestAllowedOrigins_EmptyOnCloudRunAllowsAny(t *testing.T) {
	t.Setenv("ALLOWED_ORIGINS", "")
	t.Setenv("K_SERVICE", "watchparty-ws")
	allowAny, origins := AllowedOrigins()
	assert.True(t, allowAny)
	assert.Nil(t, origins)
}

func TestAllowedOrigins_Star(t *testing.T) {
	t.Setenv("K_SERVICE", "")
	t.Setenv("ALLOWED_ORIGINS", "*")
	allowAny, origins := AllowedOrigins()
	assert.True(t, allowAny)
	assert.Nil(t, origins)
}

func TestAllowedOrigins_List(t *testing.T) {
	t.Setenv("K_SERVICE", "")
	t.Setenv("ALLOWED_ORIGINS", " https://a.com , https://b.com ")
	allowAny, origins := AllowedOrigins()
	assert.False(t, allowAny)
	assert.Equal(t, []string{"https://a.com", "https://b.com"}, origins)
}

'use strict';

//var apiPath = "http://localhost:3000"; // Test
var apiPath = "https://2d18obxvo9.execute-api.eu-central-1.amazonaws.com/dev"; // Prod

// Handler that runs when AJAX requests complete with an error (https://api.jquery.com/ajaxError/)
$(document).ajaxError(async (event, jqxhr, settings, thrownError) => {
  console.error(jqxhr);
  if (jqxhr.status === 400 && jqxhr.responseJSON.message === 'Token is expired.') {
    try {
      await refreshToken();
      hideSpinner();
    } catch (error) {
      console.error(error);
      $(location).attr('href', "login.html?redirectUrl=" + $(location).attr("href"));
    }
  }
});

//#region Spinners

function showSpinner() {
  $("#fadeMe").addClass("fadeMe");
  $("#fadeMe").show();
}

function hideSpinner(div) {
  $("#fadeMe").removeClass("fadeMe");
  $("#fadeMe").hide();
}

//#endregion

//#region Login, Register & Tokens

function login(username, password, redirectPage) {
  $.ajax({
    url: `${apiPath}/login`,
    method: "POST",
    contentType: 'application/json',
    dataType: "json",
    beforeSend: () => {
      $("#login").prop('disabled', true);
      $("#login").html(
        `<span class="spinner-border text-light" role="status" aria-hidden="true"></span> Logging you in...`
      )
    },
    data: JSON.stringify({
      username: username,
      password: password
    })
  })
    .done((data, textStatus, jqXHR) => {
      try {
        switch (jqXHR.status) {
          case 200:
            console.log(jqXHR);
            showMessage('Authentication successful');
            setTokens(data);

            // Redirect user to redirect URL or to main page
            $(location).attr('href', $.urlParam("redirectUrl") ? decodeURIComponent($.urlParam("redirectUrl")) : decodeURIComponent(redirectPage));
            break;
          default:
            showMessage("Unexpected error: " + textStatus, true);
            break;
        }
      } catch (error) {
        console.error(error);
      }
    })
    .fail((jqXHR, textStatus, errorThrown) => {
      try {
        console.error(jqXHR);
        console.error(textStatus);
        console.error(errorThrown);
        if (jqXHR.status === 401 && jqXHR.responseJSON.message === 'Password Reset Required.') {
          // Show password reset modal
          $("#loginform").slideUp();
          $("#resetform").fadeIn();
          showMessage("Your password needs to be resetted. Please follow the instructions on this page.", true);
          return;
        }
        showMessage("An error occurred. Please check your credentials.", true);
      } catch (error) {
        console.error(error);

      }
    })
    .always(() => {
      $("#login").prop('disabled', false);
      $("#login").html(
        `Log In`
      )
    })

}

function registerUser(firstName, lastName, email, password) {
  return new Promise((resolve, reject) => {
    $.ajax({
      url: `${apiPath}/register`,
      method: "POST",
      contentType: 'application/json',
      dataType: "json",
      beforeSend: () => {
        $("#registerUser").prop('disabled', true);
        $("#registerUser").html(
          `<span class="spinner-border text-light" role="status" aria-hidden="true"></span> Creating your user...`
        )
      },
      data: JSON.stringify({
        firstName: firstName,
        lastName: lastName,
        email: email,
        password: password
      })
    })
      .done((data, textStatus, jqXHR) => {
        try {
          switch (jqXHR.status) {
            case 201:
              console.log(jqXHR);
              resolve();
              break;
            default:
              showMessage("Unexpected error: " + textStatus, true);
              reject();
              break;
          }
        } catch (error) {
          console.error(error);
        }
      })
      .fail((jqXHR, textStatus, errorThrown) => {
        try {
          console.error(jqXHR);
          console.error(textStatus);
          console.error(errorThrown);
          showMessage(jqXHR.responseText, true);
        } catch (error) {
          console.error(error);
        }
        reject();
      })
      .always(() => {
        $("#registerUser").prop('disabled', false);
        $("#registerUser").html(
          `Sign Up`
        )
      });
  });
}

function confirmRegistrationCode(email, code) {
  return new Promise((resolve, reject) => {
    $.ajax({
      url: `${apiPath}/codes/confirm`,
      method: "POST",
      contentType: 'application/json',
      dataType: "json",
      data: JSON.stringify({
        username: email,
        code: code
      })
    })
      .done((data, textStatus, jqXHR) => {
        try {
          switch (jqXHR.status) {
            case 200:
              console.log(jqXHR);
              resolve();
              break;
            default:
              showMessage("Unexpected error: " + textStatus, true);
              reject();
              break;
          }
        } catch (error) {
          console.error(error);
        }
      })
      .fail((jqXHR, textStatus, errorThrown) => {
        try {
          console.error(jqXHR);
          console.error(textStatus);
          console.error(errorThrown);
          showMessage(jqXHR.responseText, true);
        } catch (error) {
          console.error(error);
        }
        reject();
      });
  });
}

async function verifyToken() {
  return new Promise(async (resolve, reject) => {
    $("#spinner-text").text('Checking your connection...');
    showSpinner();

    let token = localStorage.getItem("id_token");
    if (!token) {
      $(location).attr('href', "login.html?redirectUrl=" + $(location).attr("href"));
      reject();
    }

    console.log('Current token:', token);
    $.ajax({
      url: `${apiPath}/tokens/verify`,
      method: "POST",
      contentType: "application/json",
      dataType: "json",
      data: JSON.stringify({
        token: token
      })
    }).done((data, textStatus, jqXHR) => {
      logAjaxSuccess("POST /tokens/verify", data, textStatus, jqXHR);
      hideSpinner();
      resolve(data);
    }).fail(async (jqXHR, textStatus, errorThrown) => {
      logAjaxError("POST /tokens/verify", jqXHR, textStatus, errorThrown);
      switch (jqXHR.status) {
        case 400:
        case 401:
          console.log('Message:', jqXHR.responseJSON.message);
          if (jqXHR.responseJSON.message === "Token is expired.") {
            console.log("Trying to refresh token...");
            try {
              await refreshToken();
              resolve();
            } catch (error) {
              handleError(null, jqXHR, textStatus, errorThrown);
              $(location).attr('href', "login.html?redirectUrl=" + $(location).attr("href"));
              reject();
            }
          }
          break;
        default:
          console.error(errorThrown);
          handleError(null, jqXHR, textStatus, errorThrown);
          reject();
          break;
      }
    }).always(() => {
      console.log('verifyToken completed.');
    });
  });
}

function setTokens(data) {
  localStorage.setItem("access_token", data.accessToken);
  localStorage.setItem("id_token", data.idToken);
  localStorage.setItem("refresh_token", data.refreshToken);
}

function updateTokens(data) {

  console.log("Updating tokens:", data);

  // Id token
  var idToken = localStorage.getItem("id_token");
  idToken = data.idToken;
  console.log("Setting new idToken:", idToken);
  localStorage.setItem("id_token", idToken);

  // Access token
  var accessToken = localStorage.getItem("access_token");
  accessToken = data.accessToken;
  localStorage.setItem("access_token", accessToken);

  // Access token
  var refreshToken = localStorage.getItem("refresh_token");
  refreshToken = data.refreshToken;
  localStorage.setItem("refresh_token", refreshToken);
}

function getIdToken() {
  return localStorage.getItem("id_token") || undefined;
}

function getAccessToken() {
  return localStorage.getItem("access_token") || undefined;
}

function getRefreshToken() {
  return localStorage.getItem("refresh_token") || undefined;
}

async function refreshToken() {

  await $.ajax({
    method: "POST",
    url: `${apiPath}/tokens/refresh`,
    contentType: "application/json",
    dataType: "json",
    data: JSON.stringify({
      token: getIdToken(),
      refreshToken: getRefreshToken()
    })
  })
    .done((data, textStatus, jqXHR) => {
      logAjaxSuccess("POST /tokens/refresh", data, textStatus, jqXHR);
      updateTokens(data);
      return true;
    })
    .fail((jqXHR, textStatus, errorThrown) => {
      logAjaxError("POST /tokens/refresh", jqXHR, textStatus, errorThrown);
      return false;
    });

  return false;
}

function getHeaders(xhr) {
  xhr.setRequestHeader("Authorization", `Bearer ${getBearerToken(true)}`);
}

function getBearerToken(redirectToLogin) {
  let token = localStorage.getItem("id_token");
  if (!token && redirectToLogin) {
    $(location).attr('href', "login.html?redirectUrl=" + $(location).attr("href"));
    return;
  }
  return token;
}

function parseJwt(token) {
  var base64Url = token.split('.')[1];
  var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  var jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));

  return JSON.parse(jsonPayload);
};

function isAdmin() {
  var decodedToken = parseJwt(getIdToken());
  return decodedToken && decodedToken['cognito:groups'] && decodedToken['cognito:groups'].includes("Administrators");
}

//#endregion

//#region Users

async function getUsers(showAnonymousUsers) {
  return await $.ajax({
    url: `${apiPath}/users`,
    method: "GET",
    contentType: 'application/json',
    dataType: "json",
    beforeSend: getHeaders
  })
    .done((data, textStatus, jqXHR) => {
      logAjaxSuccess("GET /users", data, textStatus, jqXHR);
      try {
        switch (jqXHR.status) {
          case 200:
            console.log(jqXHR);
            if (!showAnonymousUsers) {
              data.dynamoDbUsers = data.dynamoDbUsers.filter(user => user.lastName !== "anon");
            }
            return data;
          default:
            showMessage("Unexpected error: " + textStatus, true);
            reject(textStatus);
            break;
        }
      } catch (error) {
        console.error(error);
        reject(error);
      }
    })
    .always(() => {
      console.log("getUsers completed");
    });
}

async function deleteUser(id) {
  return await $.ajax({
    url: `${apiPath}/users/${id}`,
    method: "DELETE",
    contentType: 'application/json',
    dataType: "json",
    beforeSend: getHeaders
  })
    .done((data, textStatus, jqXHR) => {
      logAjaxSuccess("DELETE /users/" + id, data, textStatus, jqXHR);
      try {
        switch (jqXHR.status) {
          case 204:
            console.log(jqXHR);
            showMessage('User deleted');
            return true;
          default:
            showMessage("Unexpected error: " + textStatus, true);
            throw new Error(textStatus);
        }
      } catch (error) {
        console.error(error);
        throw error;
      }
    })
    .always(() => {
      console.log("deleteUser completed");
    });
}

//#endregion

//#region Connectors

async function getConnectors() {
  return await $.ajax({
    url: `${apiPath}/connectors`,
    method: "GET",
    contentType: 'application/json',
    dataType: "json",
    beforeSend: getHeaders
  })
    .done((data, textStatus, jqXHR) => {
      logAjaxSuccess("GET /connectors", data, textStatus, jqXHR);
      try {
        switch (jqXHR.status) {
          case 200:
            console.log(jqXHR);
            return data;
          default:
            showMessage("Unexpected error: " + textStatus, true);
            reject(textStatus);
            break;
        }
      } catch (error) {
        console.error(error);
        reject(error);
      }
    })
    .always(() => {
      console.log("getConnectors completed");
    });
}

async function getConnector(connectorId) {
  return await $.ajax({
    url: `${apiPath}/connectors/${connectorId}`,
    method: "GET",
    contentType: 'application/json',
    dataType: "json",
    beforeSend: getHeaders
  })
    .done((data, textStatus, jqXHR) => {
      logAjaxSuccess("GET /connectors/" + connectorId, data, textStatus, jqXHR);
      try {
        switch (jqXHR.status) {
          case 200:
            console.log(jqXHR);
            return data;
          default:
            showMessage("Unexpected error: " + textStatus, true);
            reject(textStatus);
            break;
        }
      } catch (error) {
        console.error(error);
        reject(error);
      }
    })
    .always(() => {
      console.log("getConnector completed");
    });
}

async function deleteConnector(id) {
  return await $.ajax({
    url: `${apiPath}/connectors/${id}`,
    method: "DELETE",
    contentType: 'application/json',
    dataType: "json",
    beforeSend: getHeaders
  })
    .done((data, textStatus, jqXHR) => {
      logAjaxSuccess("DELETE /connectors/" + id, data, textStatus, jqXHR);
      try {
        switch (jqXHR.status) {
          case 204:
            console.log(jqXHR);
            showMessage('Connector deleted');
            return true;
          default:
            showMessage("Unexpected error: " + textStatus, true);
            throw new Error(textStatus);
        }
      } catch (error) {
        console.error(error);
        throw error;
      }
    })
    .always(() => {
      console.log("deleteConnector completed");
    });
}

async function saveConnector(id, name, logoUrl, path, loginParameters, requestsParameters) {
  console.log('PUT id:', id);
  console.log('name:', name);
  console.log('logoUrl:', logoUrl);
  console.log('apiPath:', path);
  console.log('login parameters:', loginParameters);
  console.log('request parameters:', requestsParameters);
  return await $.ajax({
    url: `${apiPath}/connectors/${id}`,
    method: "PUT",
    contentType: 'application/json',
    dataType: "json",
    beforeSend: getHeaders,
    data: JSON.stringify({
      provider: name,
      logoUrl: logoUrl,
      apiPath: path,
      parameters: {
        login: loginParameters,
        requests: requestsParameters
      }

    })
  })
    .done((data, textStatus, jqXHR) => {
      logAjaxSuccess("PUT /connectors/" + id, data, textStatus, jqXHR);
      try {
        switch (jqXHR.status) {
          case 200:
            console.log(jqXHR);
            showMessage('Connector updated');
            return true;
          default:
            console.error("Unexpected error: " + textStatus);
            throw new Error(textStatus);
        }
      } catch (error) {
        console.error("ERROR:", error);
        throw error;
      }
    })
    .always(() => {
      console.log("saveConnector completed");
    });
}

async function createConnector(name, logoUrl, path, loginParameters) {
  return await $.ajax({
    url: `${apiPath}/connectors`,
    method: "POST",
    contentType: 'application/json',
    dataType: "json",
    beforeSend: getHeaders,
    data: JSON.stringify({
      provider: name,
      logoUrl: logoUrl,
      apiPath: path,
      parameters: {
        login: loginParameters
      }
    })
  })
    .done((data, textStatus, jqXHR) => {
      logAjaxSuccess("POST /connectors", data, textStatus, jqXHR);
      try {
        switch (jqXHR.status) {
          case 201:
            console.log(jqXHR);
            showMessage('Connector created');
            return true;
          default:
            console.error("Unexpected error: " + textStatus);
            throw new Error(textStatus);
        }
      } catch (error) {
        console.error("ERROR:", error);
        throw error;
      }
    })
    .always(() => {
      console.log("createConnector completed");
    });
}

//#endregion

//#region Configurations

async function getConfigurations() {
  return await $.ajax({
    url: `${apiPath}/configurations`,
    method: "GET",
    contentType: 'application/json',
    dataType: "json",
    beforeSend: getHeaders
  })
    .done((data, textStatus, jqXHR) => {
      logAjaxSuccess("GET /configurations/purecloud", data, textStatus, jqXHR);
      try {
        switch (jqXHR.status) {
          case 200:
            console.log(jqXHR);
            return data;
          default:
            showMessage("Unexpected error: " + textStatus, true);
            reject(textStatus);
            break;
        }
      } catch (error) {
        console.error(error);
        reject(error);
      }
    })
    .always(() => {
      console.log("getConfigurations completed");
    });
}

async function getConfiguration(configurationId) {
  return await $.ajax({
    url: `${apiPath}/configurations/${configurationId}`,
    method: "GET",
    contentType: 'application/json',
    dataType: "json",
    beforeSend: getHeaders
  })
    .done((data, textStatus, jqXHR) => {
      logAjaxSuccess("GET /configurations/" + configurationId, data, textStatus, jqXHR);
      try {
        switch (jqXHR.status) {
          case 200:
            console.log(jqXHR);
            return data;
          default:
            showMessage("Unexpected error: " + textStatus, true);
            reject(textStatus);
            break;
        }
      } catch (error) {
        console.error(error);
        reject(error);
      }
    })
    .always(() => {
      console.log("getConfiguration completed");
    });
}

async function deleteConfiguration(id) {
  return await $.ajax({
    url: `${apiPath}/configurations/${id}`,
    method: "DELETE",
    contentType: 'application/json',
    dataType: "json",
    beforeSend: getHeaders
  })
    .done((data, textStatus, jqXHR) => {
      logAjaxSuccess("DELETE /configurations/purecloud/" + id, data, textStatus, jqXHR);
      try {
        switch (jqXHR.status) {
          case 204:
            console.log(jqXHR);
            showMessage('Configuration deleted');
            return true;
          default:
            showMessage("Unexpected error: " + textStatus, true);
            throw new Error(textStatus);
        }
      } catch (error) {
        console.error(error);
        throw error;
      }
    })
    .always(() => {
      console.log("deleteConfiguration completed");
    });
}

async function saveConfiguration(id, connectorId, name, parameters) {
  return await $.ajax({
    url: `${apiPath}/configurations/${id}`,
    method: "PUT",
    contentType: 'application/json',
    dataType: "json",
    beforeSend: getHeaders,
    data: JSON.stringify({
      connectorId: connectorId,
      configurationName: name,
      parameters: parameters
    })
  })
    .done((data, textStatus, jqXHR) => {
      logAjaxSuccess("PUT /configurations/purecloud/" + id, data, textStatus, jqXHR);
      try {
        switch (jqXHR.status) {
          case 200:
            console.log(jqXHR);
            showMessage('Configuration updated');
            return true;
          default:
            console.error("Unexpected error: " + textStatus);
            throw new Error(textStatus);
        }
      } catch (error) {
        console.error("ERROR:", error);
        throw error;
      }
    })
    .always(() => {
      console.log("saveConfiguration completed");
    });
}

async function createConfiguration(connectorId, name, parameters) {
  return await $.ajax({
    url: `${apiPath}/configurations`,
    method: "POST",
    contentType: 'application/json',
    dataType: "json",
    beforeSend: getHeaders,
    data: JSON.stringify({
      connectorId: connectorId,
      configurationName: name,
      parameters: parameters
    })
  })
    .done((data, textStatus, jqXHR) => {
      logAjaxSuccess("POST /configurations/purecloud", data, textStatus, jqXHR);
      try {
        switch (jqXHR.status) {
          case 201:
            console.log(jqXHR);
            showMessage('Configuration created');
            return true;
          default:
            console.error("Unexpected error: " + textStatus);
            throw new Error(textStatus);
        }
      } catch (error) {
        console.error("ERROR:", error);
        throw error;
      }
    })
    .always(() => {
      console.log("createConfiguration completed");
    });
}

//#endregion

//#region Requests

async function getRequests() {
  return await $.ajax({
    url: `${apiPath}/requests`,
    method: "GET",
    contentType: 'application/json',
    dataType: "json",
    beforeSend: getHeaders
  })
    .done((data, textStatus, jqXHR) => {
      logAjaxSuccess("GET /requests", data, textStatus, jqXHR);
      try {
        switch (jqXHR.status) {
          case 200:
            console.log(jqXHR);
            return data;
          default:
            showMessage("Unexpected error: " + textStatus, true);
            reject(textStatus);
            break;
        }
      } catch (error) {
        console.error(error);
        reject(error);
      }
    })
    .always(() => {
      console.log("getRequests completed");
    });
}

async function getRequest(requestId) {
  return await $.ajax({
    url: `${apiPath}/requests/${requestId}`,
    method: "GET",
    contentType: 'application/json',
    dataType: "json",
    beforeSend: getHeaders
  })
    .done((data, textStatus, jqXHR) => {
      logAjaxSuccess("GET /requests/" + requestId, data, textStatus, jqXHR);
      try {
        switch (jqXHR.status) {
          case 200:
            console.log(jqXHR);
            return data;
          default:
            showMessage("Unexpected error: " + textStatus, true);
            reject(textStatus);
            break;
        }
      } catch (error) {
        console.error(error);
        reject(error);
      }
    })
    .always(() => {
      console.log("getRequest completed");
    });
}

async function deleteRequest(id) {
  return await $.ajax({
    url: `${apiPath}/requests/${id}`,
    method: "DELETE",
    contentType: 'application/json',
    dataType: "json",
    beforeSend: getHeaders
  })
    .done((data, textStatus, jqXHR) => {
      logAjaxSuccess("DELETE /requests/" + id, data, textStatus, jqXHR);
      try {
        switch (jqXHR.status) {
          case 204:
            console.log(jqXHR);
            showMessage('Request deleted');
            return true;
          default:
            showMessage("Unexpected error: " + textStatus, true);
            throw new Error(textStatus);
        }
      } catch (error) {
        console.error(error);
        throw error;
      }
    })
    .always(() => {
      console.log("deleteRequest completed");
    });
}

async function createRequest(name, type, connectors, configurations, parameters) {
  var data = {
    requestName: name,
    connectors: connectors,
    configurations: configurations,
    body: {
      requestType: type,
      subject: {
      }
    }
  };

  $.each(parameters, (i, parameter) => {
    data.body.subject[parameter.name] = parameter.value;
  });

  console.log('Creating request:', data);

  return await $.ajax({
    url: `${apiPath}/requests`,
    method: "POST",
    contentType: 'application/json',
    dataType: "json",
    beforeSend: getHeaders,
    data: JSON.stringify(data)
  })
    .done((data, textStatus, jqXHR) => {
      logAjaxSuccess("POST /requests", data, textStatus, jqXHR);
      try {
        switch (jqXHR.status) {
          case 201:
            console.log(jqXHR);
            showMessage('Request created');
            return true;
          default:
            console.error("Unexpected error: " + textStatus);
            throw new Error(textStatus);
        }
      } catch (error) {
        console.error("ERROR:", error);
        throw error;
      }
    })
    .always(() => {
      console.log("createRequest completed");
    });
}

async function searchSubjects(connectors, configurations, subject) {

  return await $.ajax({
    url: `${apiPath}/requests/search`,
    method: "POST",
    contentType: 'application/json',
    dataType: "json",
    beforeSend: getHeaders,
    data: JSON.stringify({
      subject: subject,
      connectors: connectors,
      configurations: configurations
    })
  })
    .done((data, textStatus, jqXHR) => {
      logAjaxSuccess("POST /requests/search", data, textStatus, jqXHR);
      try {
        if (jqXHR.status === 200) {
            console.log(jqXHR);
            return data;
        } else {
            showMessage("Unexpected error: " + textStatus, true);
            reject(textStatus);
        }
      } catch (error) {
        console.error(error);
        reject(error);
      }
    })
    .always(() => {
      console.log("searchSubjects completed");
    });
}

// Can't be used as most providers don't accept a request to be updated once it was sent
// async function saveRequest(id, name, type, configurationIds, parameters) {
//   var data = {
//     requestName: name,
//     configurations: configurationIds,
//     body: {
//       requestType: type,
//       subject: {
//       }
//     }
//   };

//   $.each(parameters, (i, parameter) => {
//     data.body.subject[parameter.name] = parameter.value;
//   });

//   return await $.ajax({
//     url: `${apiPath}/requests/${id}`,
//     method: "PUT",
//     contentType: 'application/json',
//     dataType: "json",
//     beforeSend: getHeaders,
//     data: JSON.stringify(data)
//   })
//     .done((data, textStatus, jqXHR) => {
//       logAjaxSuccess("PUT /requests/" + id, data, textStatus, jqXHR);
//       try {
//         switch (jqXHR.status) {
//           case 200:
//             console.log(jqXHR);
//             showMessage('Request updated');
//             return true;
//           default:
//             console.error("Unexpected error: " + textStatus);
//             throw new Error(textStatus);
//         }
//       } catch (error) {
//         console.error("ERROR:", error);
//         throw error;
//       }
//     })
//     .always(() => {
//       console.log("saveRequest completed");
//     });
// }

//#endregion

//#region Logging/Message/Error Handling

function truncateText(str, length, ending) {
  if (length == null) {
    length = 100;
  }
  if (ending == null) {
    ending = "...";
  }
  if (str.length > length) {
    return str.substring(0, length - ending.length) + ending;
  } else {
    return str;
  }
}

function logAjaxSuccess(apiFunction, data, textStatus, jqXHR) {
  console.log(apiFunction + " -> Data:", data);
  console.log(apiFunction + " -> Text Status:", textStatus);
  console.log(apiFunction + " ->  jqXHR:", jqXHR);
}

function logAjaxError(apiFunction, jqXHR, textStatus, errorThrown) {
  console.error(apiFunction + " -> jqXHR:", jqXHR);
  console.error(apiFunction + " -> Text Status:", textStatus);
  console.error(apiFunction + " -> Error Thrown:", errorThrown);
}

function showError(control, message) {
  $(control).html(message);
  $(control).show();
}

function showMessage(heading, message) {
  $.toast({
    heading: heading
    , text: message
    , position: 'top-right'
    , loaderBg: '#ff6849'
    , icon: 'info'
    , hideAfter: 3500
    , stack: 6
  })
}

function showErrorMessage(heading, message) {
  $.toast({
    heading: heading
    , text: message
    , position: 'top-right'
    , loaderBg: '#ff0000'
    , icon: 'error'
    , hideAfter: 10000
    , stack: 6
  })
}

function clearError() {
  $("#error").hide();
  $("#loginerror").hide();
  $("#registererror").hide();
}

function handleError(functionCalled, jqXHR, textStatus, errorThrown) {
  logAjaxError(functionCalled, jqXHR, textStatus, errorThrown);
  // if (jqXHR.status == 0) {
  //     // The token probably expired. Get a new one
  //     console.log("Status is 0. Trying to refresh token");
  //     refreshToken().then((tokens) => {
  //         updateTokens(tokens);
  //         functionCalled();
  //     }).catch((error) => {
  //         throw new Error(`Failed to call ${functionCalled}:" ${error}`);
  //     })
  // }
}

//#endregion

//#region Misc

// Used to read query parameters
$.urlParam = function (name) {
  var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.search);
  return (results !== null) ? results[1] || 0 : false;
}

function showMessage(message, error = false) {
  if (!error) {
    $.toast({
      heading: "Success",
      text: message,
      position: "top-right",
      icon: "success",
      hideAfter: 5000,
      stack: 6
    });
  } else {
    $.toast({
      heading: "Error",
      text: message,
      position: "top-right",
      icon: "error",
      hideAfter: 5000,
      stack: 6
    });
  }
}

//#endregion
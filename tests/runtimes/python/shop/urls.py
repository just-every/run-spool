from django.urls import path


def checkout(request):
    order_note = "synthetic-spool-note"
    raise ValueError("django checkout failed")


urlpatterns = [path("checkout", checkout)]
